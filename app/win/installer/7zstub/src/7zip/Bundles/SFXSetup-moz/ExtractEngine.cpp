// ExtractEngine.cpp

#include "StdAfx.h"

#include "ExtractEngine.h"

#include "Common/StringConvert.h"

#include "Windows/FileDir.h"
#include "Windows/FileFind.h"
#include "Windows/Thread.h"

#include "../../UI/Common/OpenArchive.h"

#include "../../UI/Explorer/MyMessages.h"
#include "../../FileManager/FormatUtils.h"

#include "ExtractCallback.h"

using namespace NWindows;

struct CThreadExtracting
{
  CArchiveLink ArchiveLink;

  CExtractCallbackImp *ExtractCallbackSpec;
  CMyComPtr<IArchiveExtractCallback> ExtractCallback;

  #ifndef _NO_PROGRESS
  HRESULT Result;

  HRESULT Extract()
  {
    return ArchiveLink.GetArchive()->Extract(0, (UInt32)-1 , BoolToInt(false), ExtractCallback);
  }
  DWORD Process()
  {
    ExtractCallbackSpec->ProgressDialog.WaitCreating();
    Result = Extract();
    ExtractCallbackSpec->ProgressDialog.MyClose();
    return 0;
  }
  static DWORD WINAPI MyThreadFunction(void *param)
  {
    return ((CThreadExtracting *)param)->Process();
  }
  #endif
};

static const LPCWSTR kCantFindArchive = L"Can not find archive file";
static const LPCWSTR kCantOpenArchive = L"File is not correct archive";

HRESULT ExtractArchive(
    const UString &fileName, 
    const UString &folderName,
    COpenCallbackGUI *openCallback,
    bool showProgress,
    bool &isCorrupt,
    UString &errorMessage)
{
  isCorrupt = false;
  NFile::NFind::CFileInfoW archiveFileInfo;
  if (!NFile::NFind::FindFile(fileName, archiveFileInfo))
  {
    errorMessage = kCantFindArchive;
    return E_FAIL;
  }

  CThreadExtracting extracter;

  HRESULT result = MyOpenArchive(fileName, extracter.ArchiveLink, openCallback);

  if (result != S_OK)
  {
    errorMessage = kCantOpenArchive;
    return result;
  }

  UString directoryPath = folderName;
  NFile::NName::NormalizeDirPathPrefix(directoryPath);

  /*
  UString directoryPath;
  {
    UString fullPath;
    int fileNamePartStartIndex;
    if (!NWindows::NFile::NDirectory::MyGetFullPathName(fileName, fullPath, fileNamePartStartIndex))
    {
      MessageBox(NULL, "Error 1329484", "7-Zip", 0);
      return E_FAIL;
    }
    directoryPath = fullPath.Left(fileNamePartStartIndex);
  }
  */

  if(!NFile::NDirectory::CreateComplexDirectory(directoryPath))
  {
    errorMessage = MyFormatNew(IDS_CANNOT_CREATE_FOLDER, 
        #ifdef LANG        
        0x02000603, 
        #endif 
        directoryPath);
    return E_FAIL;
  }
  
  extracter.ExtractCallbackSpec = new CExtractCallbackImp;
  extracter.ExtractCallback = extracter.ExtractCallbackSpec;
  
  extracter.ExtractCallbackSpec->Init(
      extracter.ArchiveLink.GetArchive(), 
      directoryPath, L"Default", archiveFileInfo.LastWriteTime, 0);

  #ifndef _NO_PROGRESS

  if (showProgress)
  {
    CThread thread;
    if (!thread.Create(CThreadExtracting::MyThreadFunction, &extracter))
      throw 271824;
    
    UString title;
    #ifdef LANG        
    title = LangLoadString(IDS_PROGRESS_EXTRACTING, 0x02000890);
    #else
    title = NWindows::MyLoadStringW(IDS_PROGRESS_EXTRACTING);
    #endif
    extracter.ExtractCallbackSpec->StartProgressDialog(title);
    result = extracter.Result;
  }
  else

  #endif
  {
    result = extracter.Extract();
  }
  errorMessage = extracter.ExtractCallbackSpec->_message;
  isCorrupt = extracter.ExtractCallbackSpec->_isCorrupt;
  return result;
}
