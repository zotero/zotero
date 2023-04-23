// OpenArchive.h

#ifndef __OPENARCHIVE_H
#define __OPENARCHIVE_H

#include "Common/String.h"
#include "Windows/FileFind.h"

#include "../../Archive/IArchive.h"
#include "ArchiverInfo.h"
#include "ArchiveOpenCallback.h"

#ifndef EXCLUDE_COM
#include "Windows/DLL.h"
#endif

HRESULT GetArchiveItemPath(IInArchive *archive, UInt32 index, UString &result);
HRESULT GetArchiveItemPath(IInArchive *archive, UInt32 index, const UString &defaultName, UString &result);
HRESULT GetArchiveItemFileTime(IInArchive *archive, UInt32 index, 
    const FILETIME &defaultFileTime, FILETIME &fileTime);
HRESULT IsArchiveItemFolder(IInArchive *archive, UInt32 index, bool &result);
HRESULT IsArchiveItemAnti(IInArchive *archive, UInt32 index, bool &result);

struct ISetSubArchiveName
{
  virtual void SetSubArchiveName(const wchar_t *name) = 0;
};

HRESULT OpenArchive(
    IInStream *inStream,
    const UString &fileName, 
    #ifndef EXCLUDE_COM
    HMODULE *module,
    #endif
    IInArchive **archiveResult, 
    CArchiverInfo &archiverInfoResult,
    UString &defaultItemName,
    IArchiveOpenCallback *openArchiveCallback);

HRESULT OpenArchive(const UString &filePath, 
    #ifndef EXCLUDE_COM
    HMODULE *module,
    #endif
    IInArchive **archive, 
    CArchiverInfo &archiverInfo,
    UString &defaultItemName,
    IArchiveOpenCallback *openArchiveCallback);

HRESULT OpenArchive(const UString &filePath, 
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
    IArchiveOpenCallback *openArchiveCallback);


HRESULT ReOpenArchive(IInArchive *archive, 
    const UString &fileName);

HRESULT MyOpenArchive(const UString &archiveName, 
    #ifndef EXCLUDE_COM
    HMODULE *module,
    #endif
    IInArchive **archive,
    UString &defaultItemName,
    IOpenCallbackUI *openCallbackUI);

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
    IOpenCallbackUI *openCallbackUI);

struct CArchiveLink
{
  #ifndef EXCLUDE_COM
  NWindows::NDLL::CLibrary Library0;
  NWindows::NDLL::CLibrary Library1;
  #endif
  CMyComPtr<IInArchive> Archive0;
  CMyComPtr<IInArchive> Archive1;
  UString DefaultItemName0;
  UString DefaultItemName1;

  CArchiverInfo ArchiverInfo0;
  CArchiverInfo ArchiverInfo1;
  
  UStringVector VolumePaths;

  int GetNumLevels() const
  { 
    int result = 0;
    if (Archive0)
    {
      result++;
      if (Archive1)
        result++;
    }
    return result;
  }


  IInArchive *GetArchive() { return Archive1 != 0 ? Archive1: Archive0; }
  UString GetDefaultItemName()  { return Archive1 != 0 ? DefaultItemName1: DefaultItemName0; }
  const CArchiverInfo &GetArchiverInfo() { return Archive1 != 0 ? ArchiverInfo1: ArchiverInfo0; }
  HRESULT Close();
  void Release();
};

HRESULT OpenArchive(const UString &archiveName, 
    CArchiveLink &archiveLink,
    IArchiveOpenCallback *openCallback);

HRESULT MyOpenArchive(const UString &archiveName, 
    CArchiveLink &archiveLink,
    IOpenCallbackUI *openCallbackUI);

HRESULT ReOpenArchive(CArchiveLink &archiveLink, 
    const UString &fileName);

#endif

