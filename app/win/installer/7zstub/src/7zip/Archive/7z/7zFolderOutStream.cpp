// 7zFolderOutStream.cpp

#include "StdAfx.h"

#include "7zFolderOutStream.h"

namespace NArchive {
namespace N7z {

CFolderOutStream::CFolderOutStream()
{
  _outStreamWithHashSpec = new COutStreamWithCRC;
  _outStreamWithHash = _outStreamWithHashSpec;
}

HRESULT CFolderOutStream::Init(
    const CArchiveDatabaseEx *archiveDatabase,
    UInt32 ref2Offset,
    UInt32 startIndex,
    const CBoolVector *extractStatuses, 
    IArchiveExtractCallback *extractCallback,
    bool testMode)
{
  _archiveDatabase = archiveDatabase;
  _ref2Offset = ref2Offset;
  _startIndex = startIndex;

  _extractStatuses = extractStatuses;
  _extractCallback = extractCallback;
  _testMode = testMode;

  _currentIndex = 0;
  _fileIsOpen = false;
  return WriteEmptyFiles();
}

HRESULT CFolderOutStream::OpenFile()
{
  Int32 askMode;
  if((*_extractStatuses)[_currentIndex])
    askMode = _testMode ? 
        NArchive::NExtract::NAskMode::kTest :
        NArchive::NExtract::NAskMode::kExtract;
  else
    askMode = NArchive::NExtract::NAskMode::kSkip;
  CMyComPtr<ISequentialOutStream> realOutStream;

  UInt32 index = _startIndex + _currentIndex;
  RINOK(_extractCallback->GetStream(_ref2Offset + index, &realOutStream, askMode));

  _outStreamWithHashSpec->Init(realOutStream);
  if (askMode == NArchive::NExtract::NAskMode::kExtract &&
      (!realOutStream)) 
  {
    const CFileItem &fileInfo = _archiveDatabase->Files[index];
    if (!fileInfo.IsAnti && !fileInfo.IsDirectory)
      askMode = NArchive::NExtract::NAskMode::kSkip;
  }
  return _extractCallback->PrepareOperation(askMode);
}

HRESULT CFolderOutStream::WriteEmptyFiles()
{
  for(;_currentIndex < _extractStatuses->Size(); _currentIndex++)
  {
    UInt32 index = _startIndex + _currentIndex;
    const CFileItem &fileInfo = _archiveDatabase->Files[index];
    if (!fileInfo.IsAnti && !fileInfo.IsDirectory && fileInfo.UnPackSize != 0)
      return S_OK;
    RINOK(OpenFile());
    RINOK(_extractCallback->SetOperationResult(
        NArchive::NExtract::NOperationResult::kOK));
    _outStreamWithHashSpec->ReleaseStream();
  }
  return S_OK;
}

STDMETHODIMP CFolderOutStream::Write(const void *data, 
    UInt32 size, UInt32 *processedSize)
{
  UInt32 realProcessedSize = 0;
  while(_currentIndex < _extractStatuses->Size())
  {
    if (_fileIsOpen)
    {
      UInt32 index = _startIndex + _currentIndex;
      const CFileItem &fileInfo = _archiveDatabase->Files[index];
      UInt64 fileSize = fileInfo.UnPackSize;
      
      UInt32 numBytesToWrite = (UInt32)MyMin(fileSize - _filePos, 
          UInt64(size - realProcessedSize));
      
      UInt32 processedSizeLocal;
      RINOK(_outStreamWithHash->Write((const Byte *)data + realProcessedSize, 
            numBytesToWrite, &processedSizeLocal));

      _filePos += processedSizeLocal;
      realProcessedSize += processedSizeLocal;
      if (_filePos == fileSize)
      {
        bool digestsAreEqual;
        if (fileInfo.IsFileCRCDefined)
          digestsAreEqual = fileInfo.FileCRC == _outStreamWithHashSpec->GetCRC();
        else
          digestsAreEqual = true;

        RINOK(_extractCallback->SetOperationResult(
            digestsAreEqual ? 
            NArchive::NExtract::NOperationResult::kOK :
            NArchive::NExtract::NOperationResult::kCRCError));
        _outStreamWithHashSpec->ReleaseStream();
        _fileIsOpen = false;
        _currentIndex++;
      }
      if (realProcessedSize == size)
      {
        if (processedSize != NULL)
          *processedSize = realProcessedSize;
        return WriteEmptyFiles();
      }
    }
    else
    {
      RINOK(OpenFile());
      _fileIsOpen = true;
      _filePos = 0;
    }
  }
  if (processedSize != NULL)
    *processedSize = size;
  return S_OK;
}

HRESULT CFolderOutStream::FlushCorrupted(Int32 resultEOperationResult)
{
  while(_currentIndex < _extractStatuses->Size())
  {
    if (_fileIsOpen)
    {
      RINOK(_extractCallback->SetOperationResult(resultEOperationResult));
      _outStreamWithHashSpec->ReleaseStream();
      _fileIsOpen = false;
      _currentIndex++;
    }
    else
    {
      RINOK(OpenFile());
      _fileIsOpen = true;
    }
  }
  return S_OK;
}

HRESULT CFolderOutStream::WasWritingFinished()
{
  if (_currentIndex == _extractStatuses->Size())
    return S_OK;
  return E_FAIL;
}

}}
