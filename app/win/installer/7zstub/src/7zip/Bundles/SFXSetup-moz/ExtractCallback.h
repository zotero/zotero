// ExtractCallback.h

#ifndef __EXTRACTCALLBACK_H
#define __EXTRACTCALLBACK_H

#include "resource.h"

#include "Common/String.h"
#include "Windows/ResourceString.h"

#include "../../Archive/IArchive.h"

#include "../../Common/FileStreams.h"
#include "../../ICoder.h"

#ifndef _NO_PROGRESS
#include "../../FileManager/Resource/ProgressDialog/ProgressDialog.h"
#endif

class CExtractCallbackImp: 
  public IArchiveExtractCallback,
  public CMyUnknownImp
{
public:
  
  MY_UNKNOWN_IMP

  // IProgress
  STDMETHOD(SetTotal)(UInt64 size);
  STDMETHOD(SetCompleted)(const UInt64 *completeValue);

  // IExtractCallback
  STDMETHOD(GetStream)(UInt32 index, ISequentialOutStream **outStream, 
      Int32 askExtractMode);
  STDMETHOD(PrepareOperation)(Int32 askExtractMode);
  STDMETHOD(SetOperationResult)(Int32 resultEOperationResult);

private:
  CMyComPtr<IInArchive> _archiveHandler;
  UString _directoryPath;

  UString _filePath;

  UString _diskFilePath;

  bool _extractMode;
  struct CProcessedFileInfo
  {
    FILETIME UTCLastWriteTime;
    bool IsDirectory;
    UInt32 Attributes;
  } _processedFileInfo;

  COutFileStream *_outFileStreamSpec;
  CMyComPtr<ISequentialOutStream> _outFileStream;

  UString _itemDefaultName;
  FILETIME _utcLastWriteTimeDefault;
  UInt32 _attributesDefault;

  void CreateComplexDirectory(const UStringVector &dirPathParts);
public:
  #ifndef _NO_PROGRESS
  CProgressDialog ProgressDialog;
  #endif

  bool _isCorrupt;
  UString _message;

  void Init(IInArchive *archiveHandler,     
    const UString &directoryPath, 
    const UString &itemDefaultName,
    const FILETIME &utcLastWriteTimeDefault,
    UInt32 attributesDefault);

  #ifndef _NO_PROGRESS
  HRESULT StartProgressDialog(const UString &title)
  {
    ProgressDialog.Create(title, 0);
    {
      #ifdef LANG        
      ProgressDialog.SetText(LangLoadString(IDS_PROGRESS_EXTRACTING, 0x02000890));
      #else
      ProgressDialog.SetText(NWindows::MyLoadStringW(IDS_PROGRESS_EXTRACTING));
      #endif
    }

    ProgressDialog.Show(SW_SHOWNORMAL);    
    return S_OK;
  }
  virtual ~CExtractCallbackImp() { ProgressDialog.Destroy(); }
  #endif

};

#endif
