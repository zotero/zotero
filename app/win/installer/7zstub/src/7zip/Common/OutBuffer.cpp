// OutByte.cpp

#include "StdAfx.h"

#include "OutBuffer.h"

#include "../../Common/Alloc.h"

bool COutBuffer::Create(UInt32 bufferSize)
{
  const UInt32 kMinBlockSize = 1;
  if (bufferSize < kMinBlockSize)
    bufferSize = kMinBlockSize;
  if (_buffer != 0 && _bufferSize == bufferSize)
    return true;
  Free();
  _bufferSize = bufferSize;
  _buffer = (Byte *)::MidAlloc(bufferSize);
  return (_buffer != 0);
}

void COutBuffer::Free()
{
  ::MidFree(_buffer);
  _buffer = 0;
}

void COutBuffer::SetStream(ISequentialOutStream *stream)
{
  _stream = stream;
}

void COutBuffer::Init()
{
  _streamPos = 0;
  _limitPos = _bufferSize;
  _pos = 0;
  _processedSize = 0;
  _overDict = false;
  #ifdef _NO_EXCEPTIONS
  ErrorCode = S_OK;
  #endif
}

UInt64 COutBuffer::GetProcessedSize() const
{ 
  UInt64 res = _processedSize + _pos - _streamPos;
  if (_streamPos > _pos) 
    res += _bufferSize;
  return res;
}


HRESULT COutBuffer::FlushPart()
{
  // _streamPos < _bufferSize
  UInt32 size = (_streamPos >= _pos) ? (_bufferSize - _streamPos) : (_pos - _streamPos);
  HRESULT result = S_OK;
  #ifdef _NO_EXCEPTIONS
  result = ErrorCode;
  #endif
  if (_buffer2 != 0)
  {
    memmove(_buffer2, _buffer + _streamPos, size);
    _buffer2 += size;
  }

  if (_stream != 0
      #ifdef _NO_EXCEPTIONS
      && (ErrorCode == S_OK)
      #endif
     )
  {
    UInt32 processedSize = 0;
    result = _stream->Write(_buffer + _streamPos, size, &processedSize);
    size = processedSize;
  }
  _streamPos += size;
  if (_streamPos == _bufferSize)
    _streamPos = 0;
  if (_pos == _bufferSize)
  {
    _overDict = true;
    _pos = 0;
  }
  _limitPos = (_streamPos > _pos) ? _streamPos : _bufferSize;
  _processedSize += size;
  return result;
}

HRESULT COutBuffer::Flush()
{
  #ifdef _NO_EXCEPTIONS
  if (ErrorCode != S_OK)
    return ErrorCode;
  #endif

  while(_streamPos != _pos)
  {
    HRESULT result = FlushPart();
    if (result != S_OK)
      return result;
  }
  return S_OK;
}

void COutBuffer::FlushWithCheck()
{
  HRESULT result = FlushPart();
  #ifdef _NO_EXCEPTIONS
  ErrorCode = result;
  #else
  if (result != S_OK)
    throw COutBufferException(result);
  #endif
}
