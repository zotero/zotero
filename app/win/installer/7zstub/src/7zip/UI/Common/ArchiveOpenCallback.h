// ArchiveOpenCallback.h

#ifndef __ARCHIVE_OPEN_CALLBACK_H
#define __ARCHIVE_OPEN_CALLBACK_H

#include "Common/String.h"
#include "Common/MyCom.h"
#include "Windows/FileFind.h"

#ifndef _NO_CRYPTO
#include "../../IPassword.h"
#endif  
#include "../../Archive/IArchive.h"

struct IOpenCallbackUI
{
  virtual HRESULT CheckBreak() = 0;
  virtual HRESULT SetTotal(const UInt64 *files, const UInt64 *bytes) = 0;
  virtual HRESULT SetCompleted(const UInt64 *files, const UInt64 *bytes) = 0;
  #ifndef _NO_CRYPTO
  virtual HRESULT CryptoGetTextPassword(BSTR *password) = 0;
  virtual HRESULT GetPasswordIfAny(UString &password) = 0;
  #endif  
};

class COpenCallbackImp: 
  public IArchiveOpenCallback,
  public IArchiveOpenVolumeCallback,
  public IArchiveOpenSetSubArchiveName,
  #ifndef _NO_CRYPTO
  public ICryptoGetTextPassword,
  #endif  
  public CMyUnknownImp
{
public:
  #ifndef _NO_CRYPTO
  MY_UNKNOWN_IMP3(
      IArchiveOpenVolumeCallback, 
      ICryptoGetTextPassword,
      IArchiveOpenSetSubArchiveName
      )
  #else
  MY_UNKNOWN_IMP2(
      IArchiveOpenVolumeCallback, 
      IArchiveOpenSetSubArchiveName
      )
  #endif

  STDMETHOD(SetTotal)(const UInt64 *files, const UInt64 *bytes);
  STDMETHOD(SetCompleted)(const UInt64 *files, const UInt64 *bytes);

  // IArchiveOpenVolumeCallback
  STDMETHOD(GetProperty)(PROPID propID, PROPVARIANT *value);
  STDMETHOD(GetStream)(const wchar_t *name, IInStream **inStream);

  #ifndef _NO_CRYPTO
  // ICryptoGetTextPassword
  STDMETHOD(CryptoGetTextPassword)(BSTR *password);
  #endif

  STDMETHOD(SetSubArchiveName(const wchar_t *name))
  {
    _subArchiveMode = true;
    _subArchiveName = name;
    return  S_OK;
  }

private:
  UString _folderPrefix;
  NWindows::NFile::NFind::CFileInfoW _fileInfo;
  bool _subArchiveMode;
  UString _subArchiveName;
public:
  UStringVector FileNames;
  IOpenCallbackUI *Callback;
  void Init(const UString &folderPrefix,  const UString &fileName)
  {
    _folderPrefix = folderPrefix;
    if (!NWindows::NFile::NFind::FindFile(_folderPrefix + fileName, _fileInfo))
      throw 1;
    FileNames.Clear();
    _subArchiveMode = false;
  }
  int FindName(const UString &name);
};

#endif
