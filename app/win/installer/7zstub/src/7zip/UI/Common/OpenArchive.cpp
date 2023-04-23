// OpenArchive.cpp

#include "StdAfx.h"

#include "OpenArchive.h"

#include "Common/Wildcard.h"

#include "Windows/FileName.h"
#include "Windows/FileDir.h"
#include "Windows/Defs.h"
#include "Windows/PropVariant.h"

#include "../../Common/FileStreams.h"
#include "../../Common/StreamUtils.h"

#include "Common/StringConvert.h"

#ifdef FORMAT_7Z
#include "../../Archive/7z/7zHandler.h"
#endif

#ifdef FORMAT_BZIP2
#include "../../Archive/BZip2/BZip2Handler.h"
#endif

#ifdef FORMAT_GZIP
#include "../../Archive/GZip/GZipHandler.h"
#endif

#ifdef FORMAT_SPLIT
#include "../../Archive/Split/SplitHandler.h"
#endif

#ifdef FORMAT_TAR
#include "../../Archive/Tar/TarHandler.h"
#endif

#ifdef FORMAT_ZIP
#include "../../Archive/Zip/ZipHandler.h"
#endif

#ifdef FORMAT_Z
#include "../../Archive/Z/ZHandler.h"
#endif

#ifndef EXCLUDE_COM
#include "HandlerLoader.h"
#endif

#include "DefaultName.h"

using namespace NWindows;

HRESULT GetArchiveItemPath(IInArchive *archive, UInt32 index, UString &result)
{
  NCOM::CPropVariant prop;
  RINOK(archive->GetProperty(index, kpidPath, &prop));
  if(prop.vt == VT_BSTR)
    result = prop.bstrVal;
  else if (prop.vt == VT_EMPTY)
    result.Empty();
  else
    return E_FAIL;
  return S_OK;
}

HRESULT GetArchiveItemPath(IInArchive *archive, UInt32 index, const UString &defaultName, UString &result)
{
  RINOK(GetArchiveItemPath(archive, index, result));
  if (result.IsEmpty())
    result = defaultName;
  return S_OK;
}

HRESULT GetArchiveItemFileTime(IInArchive *archive, UInt32 index, 
    const FILETIME &defaultFileTime, FILETIME &fileTime)
{
  NCOM::CPropVariant prop;
  RINOK(archive->GetProperty(index, kpidLastWriteTime, &prop));
  if (prop.vt == VT_FILETIME)
    fileTime = prop.filetime;
  else if (prop.vt == VT_EMPTY)
    fileTime = defaultFileTime;
  else
    return E_FAIL;
  return S_OK;
}

static HRESULT IsArchiveItemProp(IInArchive *archive, UInt32 index, PROPID propID, bool &result)
{
  NCOM::CPropVariant prop;
  RINOK(archive->GetProperty(index, propID, &prop));
  if(prop.vt == VT_BOOL)
    result = VARIANT_BOOLToBool(prop.boolVal);
  else if (prop.vt == VT_EMPTY)
    result = false;
  else
    return E_FAIL;
  return S_OK;
}

HRESULT IsArchiveItemFolder(IInArchive *archive, UInt32 index, bool &result)
{
  return IsArchiveItemProp(archive, index, kpidIsFolder, result);
}

HRESULT IsArchiveItemAnti(IInArchive *archive, UInt32 index, bool &result)
{
  return IsArchiveItemProp(archive, index, kpidIsAnti, result);
}

// Static-SFX (for Linux) can be big
const UInt64 kMaxCheckStartPosition = 
#ifdef _WIN32
1 << 20;
#else
1 << 22;
#endif


HRESULT ReOpenArchive(IInArchive *archive, const UString &fileName)
{
  CInFileStream *inStreamSpec = new CInFileStream;
  CMyComPtr<IInStream> inStream(inStreamSpec);
  inStreamSpec->Open(fileName);
  return archive->Open(inStream, &kMaxCheckStartPosition, NULL);
}

#ifndef _SFX
static inline bool TestSignature(const Byte *p1, const Byte *p2, size_t size)
{
  for (size_t i = 0; i < size; i++)
    if (p1[i] != p2[i])
      return false;
  return true;
}
#endif

HRESULT OpenArchive(
    IInStream *inStream,
    const UString &fileName, 
    #ifndef EXCLUDE_COM
    HMODULE *module,
    #endif
    IInArchive **archiveResult, 
    CArchiverInfo &archiverInfoResult,
    UString &defaultItemName,
    IArchiveOpenCallback *openArchiveCallback)
{
  *archiveResult = NULL;
  CObjectVector<CArchiverInfo> archiverInfoList;
  ReadArchiverInfoList(archiverInfoList);
  UString extension;
  {
    int dotPos = fileName.ReverseFind(L'.');
    if (dotPos >= 0)
      extension = fileName.Mid(dotPos + 1);
  }
  CIntVector orderIndices;
  int i;
  bool finded = false;
  for(i = 0; i < archiverInfoList.Size(); i++)
  {
    if (archiverInfoList[i].FindExtension(extension) >= 0)
    {
      orderIndices.Insert(0, i);
      finded = true;
    }
    else
      orderIndices.Add(i);
  }
  
  #ifndef _SFX
  if (!finded)
  {
    CByteBuffer byteBuffer;
    const UInt32 kBufferSize = (200 << 10);
    byteBuffer.SetCapacity(kBufferSize);
    Byte *buffer = byteBuffer;
    RINOK(inStream->Seek(0, STREAM_SEEK_SET, NULL));
    UInt32 processedSize;
    RINOK(ReadStream(inStream, buffer, kBufferSize, &processedSize));
    int numFinded = 0;
    for (int pos = (int)processedSize; pos >= 0 ; pos--)
    {
      for(int i = numFinded; i < orderIndices.Size(); i++)
      {
        int index = orderIndices[i];
        const CArchiverInfo &ai = archiverInfoList[index];
        const CByteBuffer &sig = ai.StartSignature;
        if (sig.GetCapacity() == 0)
          continue;
        if (pos + sig.GetCapacity() > processedSize)
          continue;
        if (TestSignature(buffer + pos, sig, sig.GetCapacity()))
        {
          orderIndices.Delete(i);
          orderIndices.Insert(0, index);
          numFinded++;
        }
      }
    }
  }
  #endif

  HRESULT badResult = S_OK;
  for(i = 0; i < orderIndices.Size(); i++)
  {
    inStream->Seek(0, STREAM_SEEK_SET, NULL);
    const CArchiverInfo &archiverInfo = archiverInfoList[orderIndices[i]];
    #ifndef EXCLUDE_COM
    CHandlerLoader loader;
    #endif
    CMyComPtr<IInArchive> archive;

    #ifdef FORMAT_7Z
    if (archiverInfo.Name.CompareNoCase(L"7z") == 0)
      archive = new NArchive::N7z::CHandler;
    #endif

    #ifdef FORMAT_BZIP2
    if (archiverInfo.Name.CompareNoCase(L"BZip2") == 0)
      archive = new NArchive::NBZip2::CHandler;
    #endif

    #ifdef FORMAT_GZIP
    if (archiverInfo.Name.CompareNoCase(L"GZip") == 0)
      archive = new NArchive::NGZip::CHandler;
    #endif

    #ifdef FORMAT_SPLIT
    if (archiverInfo.Name.CompareNoCase(L"Split") == 0)
      archive = new NArchive::NSplit::CHandler;
    #endif

    #ifdef FORMAT_TAR
    if (archiverInfo.Name.CompareNoCase(L"Tar") == 0)
      archive = new NArchive::NTar::CHandler;
    #endif

    #ifdef FORMAT_ZIP
    if (archiverInfo.Name.CompareNoCase(L"Zip") == 0)
      archive = new NArchive::NZip::CHandler;
    #endif

    #ifdef FORMAT_Z
    if (archiverInfo.Name.CompareNoCase(L"Z") == 0)
      archive = new NArchive::NZ::CHandler;
    #endif


    #ifndef EXCLUDE_COM
    if (!archive)
    {
      HRESULT result = loader.CreateHandler(archiverInfo.FilePath, 
          archiverInfo.ClassID, (void **)&archive, false);
      if (result != S_OK)
        continue;
    }
    #endif
    
    if (!archive)
      return E_FAIL;
    
    HRESULT result = archive->Open(inStream, &kMaxCheckStartPosition, openArchiveCallback);
    if(result == S_FALSE)
      continue;
    if(result != S_OK)
    {
      badResult = result;
      if(result == E_ABORT)
        break;
      continue;
    }
    *archiveResult = archive.Detach();
    #ifndef EXCLUDE_COM
    *module = loader.Detach();
    #endif
    archiverInfoResult = archiverInfo;
    int subExtIndex = archiverInfo.FindExtension(extension);
    if (subExtIndex < 0)
      subExtIndex = 0;
    defaultItemName = GetDefaultName2(fileName, 
        archiverInfo.Extensions[subExtIndex].Ext, 
        archiverInfo.Extensions[subExtIndex].AddExt);

    return S_OK;
  }
  if (badResult != S_OK)
    return badResult;
  return S_FALSE;
}

HRESULT OpenArchive(const UString &filePath, 
    #ifndef EXCLUDE_COM
    HMODULE *module,
    #endif
    IInArchive **archiveResult, 
    CArchiverInfo &archiverInfo,
    UString &defaultItemName,
    IArchiveOpenCallback *openArchiveCallback)
{
  CInFileStream *inStreamSpec = new CInFileStream;
  CMyComPtr<IInStream> inStream(inStreamSpec);
  if (!inStreamSpec->Open(filePath))
    return GetLastError();
  return OpenArchive(inStream, ExtractFileNameFromPath(filePath),
    #ifndef EXCLUDE_COM
    module,
    #endif
    archiveResult, archiverInfo,
    defaultItemName, openArchiveCallback);
}

static void MakeDefaultName(UString &name)
{
  int dotPos = name.ReverseFind(L'.');
  if (dotPos < 0)
    return;
  UString ext = name.Mid(dotPos + 1);
  if (ext.IsEmpty())
    return;
  for (int pos = 0; pos < ext.Length(); pos++)
    if (ext[pos] < L'0' || ext[pos] > L'9')
      return;
  name = name.Left(dotPos);
}

HRESULT OpenArchive(const UString &fileName, 
    #ifndef EXCLUDE_COM
    HMODULE *module0,
    HMODULE *module1,
    #endif
    IInArchive **archive0, 
    IInArchive **archive1, 
    CArchiverInfo &archiverInfo0,
    CArchiverInfo &archiverInfo1,
    UString &defaultItemName0,
    UString &defaultItemName1,
    IArchiveOpenCallback *openArchiveCallback)
{
  HRESULT result = OpenArchive(fileName, 
    #ifndef EXCLUDE_COM
    module0,
    #endif
    archive0, archiverInfo0, defaultItemName0, openArchiveCallback);
  RINOK(result);
  CMyComPtr<IInArchiveGetStream> getStream;
  result = (*archive0)->QueryInterface(IID_IInArchiveGetStream, (void **)&getStream);
  if (result != S_OK || getStream == 0)
    return S_OK;

  CMyComPtr<ISequentialInStream> subSeqStream;
  result = getStream->GetStream(0, &subSeqStream);
  if (result != S_OK)
    return S_OK;

  CMyComPtr<IInStream> subStream;
  if (subSeqStream.QueryInterface(IID_IInStream, &subStream) != S_OK)
    return S_OK;
  if (!subStream)
    return S_OK;

  UInt32 numItems;
  RINOK((*archive0)->GetNumberOfItems(&numItems));
  if (numItems < 1)
    return S_OK;

  UString subPath;
  RINOK(GetArchiveItemPath(*archive0, 0, subPath))
  if (subPath.IsEmpty())
  {
    MakeDefaultName(defaultItemName0);
    subPath = defaultItemName0;
    if (archiverInfo0.Name.CompareNoCase(L"7z") == 0)
    {
      if (subPath.Right(3).CompareNoCase(L".7z") != 0)
        subPath += L".7z";
    }
  }
  else
    subPath = ExtractFileNameFromPath(subPath);

  CMyComPtr<IArchiveOpenSetSubArchiveName> setSubArchiveName;
  openArchiveCallback->QueryInterface(IID_IArchiveOpenSetSubArchiveName, (void **)&setSubArchiveName);
  if (setSubArchiveName)
    setSubArchiveName->SetSubArchiveName(subPath);

  result = OpenArchive(subStream, subPath, 
    #ifndef EXCLUDE_COM
    module1,
    #endif
    archive1, archiverInfo1, defaultItemName1, openArchiveCallback);
  return S_OK;
}

HRESULT MyOpenArchive(const UString &archiveName, 
    #ifndef EXCLUDE_COM
    HMODULE *module,
    #endif
    IInArchive **archive,
    UString &defaultItemName,
    IOpenCallbackUI *openCallbackUI)
{
  COpenCallbackImp *openCallbackSpec = new COpenCallbackImp;
  CMyComPtr<IArchiveOpenCallback> openCallback = openCallbackSpec;
  openCallbackSpec->Callback = openCallbackUI;

  UString fullName;
  int fileNamePartStartIndex;
  NFile::NDirectory::MyGetFullPathName(archiveName, fullName, fileNamePartStartIndex);
  openCallbackSpec->Init(
      fullName.Left(fileNamePartStartIndex), 
      fullName.Mid(fileNamePartStartIndex));

  CArchiverInfo archiverInfo;
  return OpenArchive(archiveName, 
      #ifndef EXCLUDE_COM
      module,
      #endif
      archive, 
      archiverInfo, 
      defaultItemName,
      openCallback);
}

HRESULT MyOpenArchive(const UString &archiveName, 
    #ifndef EXCLUDE_COM
    HMODULE *module0,
    HMODULE *module1,
    #endif
    IInArchive **archive0,
    IInArchive **archive1,
    UString &defaultItemName0,
    UString &defaultItemName1,
    UStringVector &volumePaths,
    IOpenCallbackUI *openCallbackUI)
{
  COpenCallbackImp *openCallbackSpec = new COpenCallbackImp;
  CMyComPtr<IArchiveOpenCallback> openCallback = openCallbackSpec;
  openCallbackSpec->Callback = openCallbackUI;

  UString fullName;
  int fileNamePartStartIndex;
  NFile::NDirectory::MyGetFullPathName(archiveName, fullName, fileNamePartStartIndex);
  UString prefix = fullName.Left(fileNamePartStartIndex);
  UString name = fullName.Mid(fileNamePartStartIndex);
  openCallbackSpec->Init(prefix, name);

  CArchiverInfo archiverInfo0, archiverInfo1;
  HRESULT result = OpenArchive(archiveName, 
      #ifndef EXCLUDE_COM
      module0,
      module1,
      #endif
      archive0, 
      archive1, 
      archiverInfo0, 
      archiverInfo1, 
      defaultItemName0,
      defaultItemName1,
      openCallback);
  RINOK(result);
  volumePaths.Add(prefix + name);
  for (int i = 0; i < openCallbackSpec->FileNames.Size(); i++)
    volumePaths.Add(prefix + openCallbackSpec->FileNames[i]);
  return S_OK;
}

HRESULT CArchiveLink::Close()
{
  if (Archive1 != 0)
    RINOK(Archive1->Close());
  if (Archive0 != 0)
    RINOK(Archive0->Close());
  return S_OK;
}

void CArchiveLink::Release()
{
  if (Archive1 != 0)
    Archive1.Release();
  if (Archive0 != 0)
    Archive0.Release();
  #ifndef EXCLUDE_COM
  Library1.Free();
  Library0.Free();
  #endif
}

HRESULT OpenArchive(const UString &archiveName, 
    CArchiveLink &archiveLink,
    IArchiveOpenCallback *openCallback)
{
  return OpenArchive(archiveName, 
    #ifndef EXCLUDE_COM
    &archiveLink.Library0, &archiveLink.Library1,
    #endif
    &archiveLink.Archive0, &archiveLink.Archive1, 
    archiveLink.ArchiverInfo0, archiveLink.ArchiverInfo1, 
    archiveLink.DefaultItemName0, archiveLink.DefaultItemName1, 
    openCallback);
}

HRESULT MyOpenArchive(const UString &archiveName, 
    CArchiveLink &archiveLink,
    IOpenCallbackUI *openCallbackUI)
{
  return MyOpenArchive(archiveName, 
    #ifndef EXCLUDE_COM
    &archiveLink.Library0, &archiveLink.Library1,
    #endif
    &archiveLink.Archive0, &archiveLink.Archive1, 
    archiveLink.DefaultItemName0, archiveLink.DefaultItemName1, 
    archiveLink.VolumePaths,
    openCallbackUI);
}

HRESULT ReOpenArchive(CArchiveLink &archiveLink, 
    const UString &fileName)
{
  if (archiveLink.GetNumLevels() > 1)
    return E_NOTIMPL;
  if (archiveLink.GetNumLevels() == 0)
    return MyOpenArchive(fileName, archiveLink, 0);
  return ReOpenArchive(archiveLink.GetArchive(), fileName);
}
