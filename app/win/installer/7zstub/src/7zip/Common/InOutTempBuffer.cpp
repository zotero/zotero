// InOutTempBuffer.cpp

#include "StdAfx.h"

#include "InOutTempBuffer.h"
#include "../../Common/Defs.h"
// #include "Windows/Defs.h"

#include "StreamUtils.h"

using namespace NWindows;
using namespace NFile;
using namespace NDirectory;

static UInt32 kTmpBufferMemorySize = (1 << 20);

static LPCTSTR kTempFilePrefixString = TEXT("iot");

CInOutTempBuffer::CInOutTempBuffer():
  _buffer(NULL)
{
}

void CInOutTempBuffer::Create()
{
  _buffer = new Byte[kTmpBufferMemorySize];
}

CInOutTempBuffer::~CInOutTempBuffer()
{
  delete []_buffer;
}
void CInOutTempBuffer::InitWriting()
{
  _bufferPosition = 0;
  _tmpFileCreated = false;
  _fileSize = 0;
}

bool CInOutTempBuffer::WriteToFile(const void *data, UInt32 size)
{
  if (size == 0)
    return true;
  if(!_tmpFileCreated)
  {
    CSysString tempDirPath;
    if(!MyGetTempPath(tempDirPath))
      return false;
    if (_tempFile.Create(tempDirPath, kTempFilePrefixString, _tmpFileName) == 0)
      return false;
    // _outFile.SetOpenCreationDispositionCreateAlways();
    if(!_outFile.Create(_tmpFileName, true))
      return false;
    _tmpFileCreated = true;
  }
  UInt32 processedSize;
  if(!_outFile.Write(data, size, processedSize))
    return false;
  _fileSize += processedSize;
  return (processedSize == size);
}

bool CInOutTempBuffer::FlushWrite()
{
  return _outFile.Close();
}

bool CInOutTempBuffer::Write(const void *data, UInt32 size)
{
  if(_bufferPosition < kTmpBufferMemorySize)
  {
    UInt32 curSize = MyMin(kTmpBufferMemorySize - _bufferPosition, size);
    memmove(_buffer + _bufferPosition, (const Byte *)data, curSize);
    _bufferPosition += curSize;
    size -= curSize;
    data = ((const Byte *)data) + curSize;
    _fileSize += curSize;
  }
  return WriteToFile(data, size);
}

bool CInOutTempBuffer::InitReading()
{
  _currentPositionInBuffer = 0;
  if(_tmpFileCreated)
    return _inFile.Open(_tmpFileName);
  return true;
}

HRESULT CInOutTempBuffer::WriteToStream(ISequentialOutStream *stream)
{
  if (_currentPositionInBuffer < _bufferPosition)
  {
    UInt32 sizeToWrite = _bufferPosition - _currentPositionInBuffer;
    RINOK(WriteStream(stream, _buffer + _currentPositionInBuffer, sizeToWrite, NULL));
    _currentPositionInBuffer += sizeToWrite;
  }
  if (!_tmpFileCreated)
    return true;
  while(true)
  {
    UInt32 localProcessedSize;
    if (!_inFile.ReadPart(_buffer, kTmpBufferMemorySize, localProcessedSize))
      return E_FAIL;
    if (localProcessedSize == 0)
      return S_OK;
    RINOK(WriteStream(stream, _buffer, localProcessedSize, NULL));
  }
}

STDMETHODIMP CSequentialOutTempBufferImp::Write(const void *data, UInt32 size, UInt32 *processedSize)
{
  if (!_buffer->Write(data, size))
  {
    if (processedSize != NULL)
      *processedSize = 0;
    return E_FAIL;
  }
  if (processedSize != NULL)
    *processedSize = size;
  return S_OK;
}
