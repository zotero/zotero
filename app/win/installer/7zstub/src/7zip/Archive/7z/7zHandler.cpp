// 7zHandler.cpp

#include "StdAfx.h"

#include "7zHandler.h"
#include "7zProperties.h"

#include "../../../Common/IntToString.h"
#include "../../../Common/ComTry.h"
#include "../../../Windows/Defs.h"

#include "../Common/ItemNameUtils.h"
#ifdef _7Z_VOL
#include "../Common/MultiStream.h"
#endif

#ifdef __7Z_SET_PROPERTIES
#ifdef EXTRACT_ONLY
#include "../Common/ParseProperties.h"
#endif
#endif

using namespace NWindows;

namespace NArchive {
namespace N7z {

CHandler::CHandler()
{
  #ifdef COMPRESS_MT
  _numThreads = NWindows::NSystem::GetNumberOfProcessors();
  #endif
  #ifndef EXTRACT_ONLY
  Init();
  #endif
  #ifndef EXCLUDE_COM
  LoadMethodMap();
  #endif
}

STDMETHODIMP CHandler::GetNumberOfItems(UInt32 *numItems)
{
  COM_TRY_BEGIN
  *numItems = 
  #ifdef _7Z_VOL
  _refs.Size();
  #else
  *numItems = _database.Files.Size();
  #endif
  return S_OK;
  COM_TRY_END
}

STDMETHODIMP CHandler::GetArchiveProperty(PROPID propID, PROPVARIANT *value)
{
  value->vt = VT_EMPTY;
  return S_OK;
}

#ifdef _SFX

STDMETHODIMP CHandler::GetNumberOfProperties(UInt32 *numProperties)
{
  return E_NOTIMPL;
}

STDMETHODIMP CHandler::GetPropertyInfo(UInt32 index,     
      BSTR *name, PROPID *propID, VARTYPE *varType)
{
  return E_NOTIMPL;
}

#endif


STDMETHODIMP CHandler::GetNumberOfArchiveProperties(UInt32 *numProperties)
{
  *numProperties = 0;
  return S_OK;
}

STDMETHODIMP CHandler::GetArchivePropertyInfo(UInt32 index,     
      BSTR *name, PROPID *propID, VARTYPE *varType)
{
  return E_NOTIMPL;
}


static void MySetFileTime(bool timeDefined, FILETIME unixTime, 
    NWindows::NCOM::CPropVariant &propVariant)
{
  if (timeDefined)
    propVariant = unixTime;
}

/*
inline static wchar_t GetHex(Byte value)
{
  return (value < 10) ? ('0' + value) : ('A' + (value - 10));
}

static UString ConvertBytesToHexString(const Byte *data, UInt32 size)
{
  UString result;
  for (UInt32 i = 0; i < size; i++)
  {
    Byte b = data[i];
    result += GetHex(b >> 4);
    result += GetHex(b & 0xF);
  }
  return result;
}
*/


#ifndef _SFX

static UString ConvertUInt32ToString(UInt32 value)
{
  wchar_t buffer[32];
  ConvertUInt64ToString(value, buffer);
  return buffer;
}

static UString GetStringForSizeValue(UInt32 value)
{
  for (int i = 31; i >= 0; i--)
    if ((UInt32(1) << i) == value)
      return ConvertUInt32ToString(i);
  UString result;
  if (value % (1 << 20) == 0)
  {
    result += ConvertUInt32ToString(value >> 20);
    result += L"m";
  }
  else if (value % (1 << 10) == 0)
  {
    result += ConvertUInt32ToString(value >> 10);
    result += L"k";
  }
  else
  {
    result += ConvertUInt32ToString(value);
    result += L"b";
  }
  return result;
}

static CMethodID k_Copy  = { { 0x0 }, 1 };
static CMethodID k_LZMA  = { { 0x3, 0x1, 0x1 }, 3 };
static CMethodID k_BCJ   = { { 0x3, 0x3, 0x1, 0x3 }, 4 };
static CMethodID k_BCJ2  = { { 0x3, 0x3, 0x1, 0x1B }, 4 };
static CMethodID k_PPMD  = { { 0x3, 0x4, 0x1 }, 3 };
static CMethodID k_Deflate = { { 0x4, 0x1, 0x8 }, 3 };
static CMethodID k_BZip2 = { { 0x4, 0x2, 0x2 }, 3 };

static inline char GetHex(Byte value)
{
  return (value < 10) ? ('0' + value) : ('A' + (value - 10));
}
static inline UString GetHex2(Byte value)
{
  UString result;
  result += GetHex(value >> 4);
  result += GetHex(value & 0xF);
  return result;
}

#endif

static inline UInt32 GetUInt32FromMemLE(const Byte *p)
{
  return p[0] | (((UInt32)p[1]) << 8) | (((UInt32)p[2]) << 16) | (((UInt32)p[3]) << 24);
}

STDMETHODIMP CHandler::GetProperty(UInt32 index, PROPID propID,  PROPVARIANT *value)
{
  COM_TRY_BEGIN
  NWindows::NCOM::CPropVariant propVariant;
  
  /*
  const CRef2 &ref2 = _refs[index];
  if (ref2.Refs.IsEmpty())
    return E_FAIL;
  const CRef &ref = ref2.Refs.Front();
  */
  
  #ifdef _7Z_VOL
  const CRef &ref = _refs[index];
  const CVolume &volume = _volumes[ref.VolumeIndex];
  const CArchiveDatabaseEx &_database = volume.Database;
  UInt32 index2 = ref.ItemIndex;
  const CFileItem &item = _database.Files[index2];
  #else
  const CFileItem &item = _database.Files[index];
  UInt32 index2 = index;
  #endif

  switch(propID)
  {
    case kpidPath:
    {
      if (!item.Name.IsEmpty())
        propVariant = NItemName::GetOSName(item.Name);
      break;
    }
    case kpidIsFolder:
      propVariant = item.IsDirectory;
      break;
    case kpidSize:
    {
      propVariant = item.UnPackSize;
      // propVariant = ref2.UnPackSize;
      break;
    }
    case kpidPosition:
    {
      /*
      if (ref2.Refs.Size() > 1)
        propVariant = ref2.StartPos;
      else
      */
        if (item.IsStartPosDefined)
          propVariant = item.StartPos;
      break;
    }
    case kpidPackedSize:
    {
      // propVariant = ref2.PackSize;
      {
        CNum folderIndex = _database.FileIndexToFolderIndexMap[index2];
        if (folderIndex != kNumNoIndex)
        {
          if (_database.FolderStartFileIndex[folderIndex] == (CNum)index2)
            propVariant = _database.GetFolderFullPackSize(folderIndex);
          /*
          else
            propVariant = UInt64(0);
          */
        }
        else
          propVariant = UInt64(0);
      }
      break;
    }
    case kpidLastAccessTime:
      MySetFileTime(item.IsLastAccessTimeDefined, item.LastAccessTime, propVariant);
      break;
    case kpidCreationTime:
      MySetFileTime(item.IsCreationTimeDefined, item.CreationTime, propVariant);
      break;
    case kpidLastWriteTime:
      MySetFileTime(item.IsLastWriteTimeDefined, item.LastWriteTime, propVariant);
      break;
    case kpidAttributes:
      if (item.AreAttributesDefined)
        propVariant = item.Attributes;
      break;
    case kpidCRC:
      if (item.IsFileCRCDefined)
        propVariant = item.FileCRC;
      break;
    #ifndef _SFX
    case kpidMethod:
      {
        CNum folderIndex = _database.FileIndexToFolderIndexMap[index2];
        if (folderIndex != kNumNoIndex)
        {
          const CFolder &folderInfo = _database.Folders[folderIndex];
          UString methodsString;
          for (int i = folderInfo.Coders.Size() - 1; i >= 0; i--)
          {
            const CCoderInfo &coderInfo = folderInfo.Coders[i];
            if (!methodsString.IsEmpty())
              methodsString += L' ';
            CMethodInfo methodInfo;

            bool methodIsKnown;

            for (int j = 0; j < coderInfo.AltCoders.Size(); j++)
            {
              if (j > 0)
                methodsString += L"|";
              const CAltCoderInfo &altCoderInfo = coderInfo.AltCoders[j];

              UString methodName;
              #ifdef NO_REGISTRY

              methodIsKnown = true;
              if (altCoderInfo.MethodID == k_Copy)
                methodName = L"Copy";            
              else if (altCoderInfo.MethodID == k_LZMA)
                methodName = L"LZMA";
              else if (altCoderInfo.MethodID == k_BCJ)
                methodName = L"BCJ";
              else if (altCoderInfo.MethodID == k_BCJ2)
                methodName = L"BCJ2";
              else if (altCoderInfo.MethodID == k_PPMD)
                methodName = L"PPMD";
              else if (altCoderInfo.MethodID == k_Deflate)
                methodName = L"Deflate";
              else if (altCoderInfo.MethodID == k_BZip2)
                methodName = L"BZip2";
              else
                methodIsKnown = false;
              
              #else
            
              methodIsKnown = GetMethodInfo(
                altCoderInfo.MethodID, methodInfo);
              methodName = methodInfo.Name;
              
              #endif

              if (methodIsKnown)
              {
                methodsString += methodName;
                if (altCoderInfo.MethodID == k_LZMA)
                {
                  if (altCoderInfo.Properties.GetCapacity() >= 5)
                  {
                    methodsString += L":";
                    UInt32 dicSize = GetUInt32FromMemLE(
                      ((const Byte *)altCoderInfo.Properties + 1));
                    methodsString += GetStringForSizeValue(dicSize);
                  }
                }
                else if (altCoderInfo.MethodID == k_PPMD)
                {
                  if (altCoderInfo.Properties.GetCapacity() >= 5)
                  {
                    Byte order = *(const Byte *)altCoderInfo.Properties;
                    methodsString += L":o";
                    methodsString += ConvertUInt32ToString(order);
                    methodsString += L":mem";
                    UInt32 dicSize = GetUInt32FromMemLE(
                      ((const Byte *)altCoderInfo.Properties + 1));
                    methodsString += GetStringForSizeValue(dicSize);
                  }
                }
                else
                {
                  if (altCoderInfo.Properties.GetCapacity() > 0)
                  {
                    methodsString += L":[";
                    for (size_t bi = 0; bi < altCoderInfo.Properties.GetCapacity(); bi++)
                    {
                      if (bi > 2 && bi + 1 < altCoderInfo.Properties.GetCapacity())
                      {
                        methodsString += L"..";
                        break;
                      }
                      else
                        methodsString += GetHex2(altCoderInfo.Properties[bi]);
                    }
                    methodsString += L"]";
                  }
                }
              }
              else
              {
                methodsString += altCoderInfo.MethodID.ConvertToString();
              }
            }
          }
          propVariant = methodsString;
        }
      }
      break;
    case kpidBlock:
      {
        CNum folderIndex = _database.FileIndexToFolderIndexMap[index2];
        if (folderIndex != kNumNoIndex)
          propVariant = (UInt32)folderIndex;
      }
      break;
    case kpidPackedSize0:
    case kpidPackedSize1:
    case kpidPackedSize2:
    case kpidPackedSize3:
    case kpidPackedSize4:
      {
        CNum folderIndex = _database.FileIndexToFolderIndexMap[index2];
        if (folderIndex != kNumNoIndex)
        {
          const CFolder &folderInfo = _database.Folders[folderIndex];
          if (_database.FolderStartFileIndex[folderIndex] == (CNum)index2 &&
              folderInfo.PackStreams.Size() > (int)(propID - kpidPackedSize0))
          {
            propVariant = _database.GetFolderPackStreamSize(folderIndex, propID - kpidPackedSize0);
          }
          else
            propVariant = UInt64(0);
        }
        else
          propVariant = UInt64(0);
      }
      break;
    #endif
    case kpidIsAnti:
      propVariant = item.IsAnti;
      break;
  }
  propVariant.Detach(value);
  return S_OK;
  COM_TRY_END
}

static const wchar_t *kExt = L"7z";
static const wchar_t *kAfterPart = L".7z";

#ifdef _7Z_VOL

class CVolumeName
{
  bool _first;
  UString _unchangedPart;
  UString _changedPart;    
  UString _afterPart;    
public:
  bool InitName(const UString &name)
  {
    _first = true;
    int dotPos = name.ReverseFind('.');
    UString basePart = name;
    if (dotPos >= 0)
    {
      UString ext = name.Mid(dotPos + 1);
      if (ext.CompareNoCase(kExt)==0 || 
        ext.CompareNoCase(L"EXE") == 0)
      {
        _afterPart = kAfterPart;
        basePart = name.Left(dotPos);
      }
    }

    int numLetters = 1;
    bool splitStyle = false;
    if (basePart.Right(numLetters) == L"1")
    {
      while (numLetters < basePart.Length())
      {
        if (basePart[basePart.Length() - numLetters - 1] != '0')
          break;
        numLetters++;
      }
    }
    else 
      return false;
    _unchangedPart = basePart.Left(basePart.Length() - numLetters);
    _changedPart = basePart.Right(numLetters);
    return true;
  }

  UString GetNextName()
  {
    UString newName; 
    // if (_newStyle || !_first)
    {
      int i;
      int numLetters = _changedPart.Length();
      for (i = numLetters - 1; i >= 0; i--)
      {
        wchar_t c = _changedPart[i];
        if (c == L'9')
        {
          c = L'0';
          newName = c + newName;
          if (i == 0)
            newName = UString(L'1') + newName;
          continue;
        }
        c++;
        newName = UString(c) + newName;
        i--;
        for (; i >= 0; i--)
          newName = _changedPart[i] + newName;
        break;
      }
      _changedPart = newName;
    }
    _first = false;
    return _unchangedPart + _changedPart + _afterPart;
  }
};

#endif

STDMETHODIMP CHandler::Open(IInStream *stream,
    const UInt64 *maxCheckStartPosition, 
    IArchiveOpenCallback *openArchiveCallback)
{
  COM_TRY_BEGIN
  Close();
  #ifndef _SFX
  _fileInfoPopIDs.Clear();
  #endif
  try
  {
    CMyComPtr<IArchiveOpenCallback> openArchiveCallbackTemp = openArchiveCallback;
    #ifdef _7Z_VOL
    CVolumeName seqName;

    CMyComPtr<IArchiveOpenVolumeCallback> openVolumeCallback;
    #endif

    #ifndef _NO_CRYPTO
    CMyComPtr<ICryptoGetTextPassword> getTextPassword;
    if (openArchiveCallback)
    {
      openArchiveCallbackTemp.QueryInterface(
          IID_ICryptoGetTextPassword, &getTextPassword);
    }
    #endif
    #ifdef _7Z_VOL
    if (openArchiveCallback)
    {
      openArchiveCallbackTemp.QueryInterface(IID_IArchiveOpenVolumeCallback, &openVolumeCallback);
    }
    while(true)
    {
      CMyComPtr<IInStream> inStream;
      if (!_volumes.IsEmpty())
      {
        if (!openVolumeCallback)
          break;
        if(_volumes.Size() == 1)
        {
          UString baseName;
          {
            NCOM::CPropVariant propVariant;
            RINOK(openVolumeCallback->GetProperty(kpidName, &propVariant));
            if (propVariant.vt != VT_BSTR)
              break;
            baseName = propVariant.bstrVal;
          }
          seqName.InitName(baseName);
        }

        UString fullName = seqName.GetNextName();
        HRESULT result = openVolumeCallback->GetStream(fullName, &inStream);
        if (result == S_FALSE)
          break;
        if (result != S_OK)
          return result;
        if (!stream)
          break;
      }
      else
        inStream = stream;

      CInArchive archive;
      RINOK(archive.Open(inStream, maxCheckStartPosition));

      _volumes.Add(CVolume());
      CVolume &volume = _volumes.Back();
      CArchiveDatabaseEx &database = volume.Database;
      volume.Stream = inStream;
      volume.StartRef2Index = _refs.Size();

      HRESULT result = archive.ReadDatabase(database
          #ifndef _NO_CRYPTO
          , getTextPassword
          #endif
          );
      if (result != S_OK)
      {
        _volumes.Clear();
        return result;
      }
      database.Fill();
      for(int i = 0; i < database.Files.Size(); i++)
      {
        CRef refNew;
        refNew.VolumeIndex = _volumes.Size() - 1;
        refNew.ItemIndex = i;
        _refs.Add(refNew);
        /*
        const CFileItem &file = database.Files[i];
        int j;
        */
        /*
        for (j = _refs.Size() - 1; j >= 0; j--)
        {
          CRef2 &ref2 = _refs[j];
          const CRef &ref = ref2.Refs.Back();
          const CVolume &volume2 = _volumes[ref.VolumeIndex];
          const CArchiveDatabaseEx &database2 = volume2.Database;
          const CFileItem &file2 = database2.Files[ref.ItemIndex];
          if (file2.Name.CompareNoCase(file.Name) == 0)
          {
            if (!file.IsStartPosDefined)
              continue;
            if (file.StartPos != ref2.StartPos + ref2.UnPackSize)
              continue;
            ref2.Refs.Add(refNew);
            break;
          }
        }
        */
        /*
        j = -1;
        if (j < 0)
        {
          CRef2 ref2New;
          ref2New.Refs.Add(refNew);
          j = _refs.Add(ref2New);
        }
        CRef2 &ref2 = _refs[j];
        ref2.UnPackSize += file.UnPackSize;
        ref2.PackSize += database.GetFilePackSize(i);
        if (ref2.Refs.Size() == 1 && file.IsStartPosDefined)
          ref2.StartPos = file.StartPos;
        */
      }
      if (database.Files.Size() != 1)
        break;
      const CFileItem &file = database.Files.Front();
      if (!file.IsStartPosDefined)
        break;
    }
    #else
    CInArchive archive;
    RINOK(archive.Open(stream, maxCheckStartPosition));
    HRESULT result = archive.ReadDatabase(_database
      #ifndef _NO_CRYPTO
      , getTextPassword
      #endif
      );
    RINOK(result);
    _database.Fill();
    _inStream = stream;
    #endif
  }
  catch(...)
  {
    Close();
    return S_FALSE;
  }
  // _inStream = stream;
  #ifndef _SFX
  FillPopIDs();
  #endif
  return S_OK;
  COM_TRY_END
}

STDMETHODIMP CHandler::Close()
{
  COM_TRY_BEGIN
  #ifdef _7Z_VOL
  _volumes.Clear();
  _refs.Clear();
  #else
  _inStream.Release();
  _database.Clear();
  #endif
  return S_OK;
  COM_TRY_END
}

#ifdef _7Z_VOL
STDMETHODIMP CHandler::GetStream(UInt32 index, ISequentialInStream **stream)
{
  if (index != 0)
    return E_INVALIDARG;
  *stream = 0;
  CMultiStream *streamSpec = new CMultiStream;
  CMyComPtr<ISequentialInStream> streamTemp = streamSpec;
  
  UInt64 pos = 0;
  const UString *fileName;
  for (int i = 0; i < _refs.Size(); i++)
  {
    const CRef &ref = _refs[i];
    const CVolume &volume = _volumes[ref.VolumeIndex];
    const CArchiveDatabaseEx &database = volume.Database;
    const CFileItem &file = database.Files[ref.ItemIndex];
    if (i == 0)
      fileName = &file.Name;
    else
      if (fileName->Compare(file.Name) != 0)
        return S_FALSE;
    if (!file.IsStartPosDefined)
      return S_FALSE;
    if (file.StartPos != pos)
      return S_FALSE;
    CNum folderIndex = database.FileIndexToFolderIndexMap[ref.ItemIndex];
    if (folderIndex == kNumNoIndex)
    {
      if (file.UnPackSize != 0)
        return E_FAIL;
      continue;
    }
    if (database.NumUnPackStreamsVector[folderIndex] != 1)
      return S_FALSE;
    const CFolder &folder = database.Folders[folderIndex];
    if (folder.Coders.Size() != 1)
      return S_FALSE;
    const CCoderInfo &coder = folder.Coders.Front();
    if (coder.NumInStreams != 1 || coder.NumOutStreams != 1)
      return S_FALSE;
    const CAltCoderInfo &altCoder = coder.AltCoders.Front();
    if (altCoder.MethodID.IDSize != 1 || altCoder.MethodID.ID[0] != 0)
      return S_FALSE;

    pos += file.UnPackSize;
    CMultiStream::CSubStreamInfo subStreamInfo;
    subStreamInfo.Stream = volume.Stream;
    subStreamInfo.Pos = database.GetFolderStreamPos(folderIndex, 0);
    subStreamInfo.Size = file.UnPackSize;
    streamSpec->Streams.Add(subStreamInfo);
  }
  streamSpec->Init();
  *stream = streamTemp.Detach();
  return S_OK;
}
#endif


#ifdef __7Z_SET_PROPERTIES
#ifdef EXTRACT_ONLY

STDMETHODIMP CHandler::SetProperties(const wchar_t **names, const PROPVARIANT *values, Int32 numProperties)
{
  COM_TRY_BEGIN
  const UInt32 numProcessors = NSystem::GetNumberOfProcessors();
  _numThreads = numProcessors;

  for (int i = 0; i < numProperties; i++)
  {
    UString name = names[i];
    name.MakeUpper();
    if (name.IsEmpty())
      return E_INVALIDARG;
    const PROPVARIANT &value = values[i];
    UInt32 number;
    int index = ParseStringToUInt32(name, number);
    if (index == 0)
    {
      if(name.Left(2).CompareNoCase(L"MT") == 0)
      {
        RINOK(ParseMtProp(name.Mid(2), value, numProcessors, _numThreads));
        continue;
      }
      else
        return E_INVALIDARG;
    }
  }
  return S_OK;
  COM_TRY_END
}  

#endif
#endif

}}
