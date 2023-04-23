// 7zFolderOutStream.h

#ifndef __7Z_FOLDEROUTSTREAM_H
#define __7Z_FOLDEROUTSTREAM_H

#include "7zIn.h"

#include "../../IStream.h"
#include "../IArchive.h"
#include "../Common/OutStreamWithCRC.h"

namespace NArchive {
namespace N7z {

class CFolderOutStream: 
  public ISequentialOutStream,
  public CMyUnknownImp
{
public:
  MY_UNKNOWN_IMP
  
  CFolderOutStream();

  STDMETHOD(Write)(const void *data, UInt32 size, UInt32 *processedSize);
private:

  COutStreamWithCRC *_outStreamWithHashSpec;
  CMyComPtr<ISequentialOutStream> _outStreamWithHash;
  const CArchiveDatabaseEx *_archiveDatabase;
  const CBoolVector *_extractStatuses;
  UInt32 _startIndex;
  UInt32 _ref2Offset;
  int _currentIndex;
  // UInt64 _currentDataPos;
  CMyComPtr<IArchiveExtractCallback> _extractCallback;
  bool _testMode;

  bool _fileIsOpen;
  UInt64 _filePos;

  HRESULT OpenFile();
  HRESULT WriteEmptyFiles();
public:
  HRESULT Init(
      const CArchiveDatabaseEx *archiveDatabase,
      UInt32 ref2Offset,
      UInt32 startIndex,
      const CBoolVector *extractStatuses, 
      IArchiveExtractCallback *extractCallback,
      bool testMode);
  HRESULT FlushCorrupted(Int32 resultEOperationResult);
  HRESULT WasWritingFinished();
};

}}

#endif
