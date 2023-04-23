// x86_2.cpp

#include "StdAfx.h"
#include "x86_2.h"

#include "../../../Common/Alloc.h"

static const int kBufferSize = 1 << 17;

inline bool IsJcc(Byte b0, Byte b1)
{
  return (b0 == 0x0F && (b1 & 0xF0) == 0x80);
}

#ifndef EXTRACT_ONLY

static bool inline Test86MSByte(Byte b)
{
  return (b == 0 || b == 0xFF);
}

bool CBCJ2_x86_Encoder::Create()
{
  if (!_mainStream.Create(1 << 16))
    return false;
  if (!_callStream.Create(1 << 20))
    return false;
  if (!_jumpStream.Create(1 << 20))
    return false;
  if (!_rangeEncoder.Create(1 << 20))
    return false;
  if (_buffer == 0)
  {
    _buffer = (Byte *)MidAlloc(kBufferSize);
    if (_buffer == 0)
      return false;
  }
  return true;
}

CBCJ2_x86_Encoder::~CBCJ2_x86_Encoder()
{
  ::MidFree(_buffer);
}

HRESULT CBCJ2_x86_Encoder::Flush()
{
  RINOK(_mainStream.Flush());
  RINOK(_callStream.Flush());
  RINOK(_jumpStream.Flush());
  _rangeEncoder.FlushData();
  return _rangeEncoder.FlushStream();
}

const UInt32 kDefaultLimit = (1 << 24);

HRESULT CBCJ2_x86_Encoder::CodeReal(ISequentialInStream **inStreams,
      const UInt64 **inSizes,
      UInt32 numInStreams,
      ISequentialOutStream **outStreams,
      const UInt64 **outSizes,
      UInt32 numOutStreams,
      ICompressProgressInfo *progress)
{
  if (numInStreams != 1 || numOutStreams != 4)
    return E_INVALIDARG;

  if (!Create())
    return E_OUTOFMEMORY;

  bool sizeIsDefined = false;
  UInt64 inSize;
  if (inSizes != NULL)
    if (inSizes[0] != NULL)
    {
      inSize = *inSizes[0];
      if (inSize <= kDefaultLimit)
        sizeIsDefined = true;
    }

  ISequentialInStream *inStream = inStreams[0];

  _mainStream.SetStream(outStreams[0]);
  _mainStream.Init();
  _callStream.SetStream(outStreams[1]);
  _callStream.Init();
  _jumpStream.SetStream(outStreams[2]);
  _jumpStream.Init();
  _rangeEncoder.SetStream(outStreams[3]);
  _rangeEncoder.Init();
  for (int i = 0; i < 256; i++)
    _statusE8Encoder[i].Init();
  _statusE9Encoder.Init();
  _statusJccEncoder.Init();
  CCoderReleaser releaser(this);

  CMyComPtr<ICompressGetSubStreamSize> getSubStreamSize;
  {
    inStream->QueryInterface(IID_ICompressGetSubStreamSize, (void **)&getSubStreamSize);
  }

  UInt32 nowPos = 0;
  UInt64 nowPos64 = 0;
  UInt32 bufferPos = 0;

  Byte prevByte = 0;

  UInt64 subStreamIndex = 0;
  UInt64 subStreamStartPos  = 0;
  UInt64 subStreamEndPos = 0;

  while(true)
  {
    UInt32 processedSize = 0;
    while(true)
    {
      UInt32 size = kBufferSize - (bufferPos + processedSize);
      UInt32 processedSizeLoc;
      if (size == 0)
        break;
      RINOK(inStream->Read(_buffer + bufferPos + processedSize, size, &processedSizeLoc));
      if (processedSizeLoc == 0)
        break;
      processedSize += processedSizeLoc;
    }
    UInt32 endPos = bufferPos + processedSize;
    
    if (endPos < 5)
    {
      // change it 
      for (bufferPos = 0; bufferPos < endPos; bufferPos++)
      {
        Byte b = _buffer[bufferPos];
        _mainStream.WriteByte(b);
        if (b == 0xE8)
          _statusE8Encoder[prevByte].Encode(&_rangeEncoder, 0);
        else if (b == 0xE9)
          _statusE9Encoder.Encode(&_rangeEncoder, 0);
        else if (IsJcc(prevByte, b))
          _statusJccEncoder.Encode(&_rangeEncoder, 0);
        prevByte = b;
      }
      return Flush();
    }

    bufferPos = 0;

    UInt32 limit = endPos - 5;
    while(bufferPos <= limit)
    {
      Byte b = _buffer[bufferPos];
      _mainStream.WriteByte(b);
      if (b != 0xE8 && b != 0xE9 && !IsJcc(prevByte, b))
      {
        bufferPos++;
        prevByte = b;
        continue;
      }
      Byte nextByte = _buffer[bufferPos + 4];
      UInt32 src = 
        (UInt32(nextByte) << 24) |
        (UInt32(_buffer[bufferPos + 3]) << 16) |
        (UInt32(_buffer[bufferPos + 2]) << 8) |
        (_buffer[bufferPos + 1]);
      UInt32 dest = (nowPos + bufferPos + 5) + src;
      // if (Test86MSByte(nextByte))
      bool convert;
      if (getSubStreamSize != NULL)
      {
        UInt64 currentPos = (nowPos64 + bufferPos);
        while (subStreamEndPos < currentPos)
        {
          UInt64 subStreamSize;
          HRESULT result = getSubStreamSize->GetSubStreamSize(subStreamIndex, &subStreamSize);
          if (result == S_OK)
          {
            subStreamStartPos = subStreamEndPos;
            subStreamEndPos += subStreamSize;          
            subStreamIndex++;
          }
          else if (result == S_FALSE || result == E_NOTIMPL)
          {
            getSubStreamSize.Release();
            subStreamStartPos = 0;
            subStreamEndPos = subStreamStartPos - 1;          
          }
          else
            return result;
        }
        if (getSubStreamSize == NULL)
        {
          if (sizeIsDefined)
            convert = (dest < inSize);
          else
            convert = Test86MSByte(nextByte);
        }
        else if (subStreamEndPos - subStreamStartPos > kDefaultLimit)
          convert = Test86MSByte(nextByte);
        else
        {
          UInt64 dest64 = (currentPos + 5) + Int64(Int32(src));
          convert = (dest64 >= subStreamStartPos && dest64 < subStreamEndPos);
        }
      }
      else if (sizeIsDefined)
        convert = (dest < inSize);
      else
        convert = Test86MSByte(nextByte);
      if (convert)
      {
        if (b == 0xE8)
          _statusE8Encoder[prevByte].Encode(&_rangeEncoder, 1);
        else if (b == 0xE9)
          _statusE9Encoder.Encode(&_rangeEncoder, 1);
        else 
          _statusJccEncoder.Encode(&_rangeEncoder, 1);

        bufferPos += 5;
        if (b == 0xE8)
        {
          _callStream.WriteByte((Byte)(dest >> 24));
          _callStream.WriteByte((Byte)(dest >> 16));
          _callStream.WriteByte((Byte)(dest >> 8));
          _callStream.WriteByte((Byte)(dest));
        }
        else 
        {
          _jumpStream.WriteByte((Byte)(dest >> 24));
          _jumpStream.WriteByte((Byte)(dest >> 16));
          _jumpStream.WriteByte((Byte)(dest >> 8));
          _jumpStream.WriteByte((Byte)(dest));
        }
        prevByte = nextByte;
      }
      else
      {
        if (b == 0xE8)
          _statusE8Encoder[prevByte].Encode(&_rangeEncoder, 0);
        else if (b == 0xE9)
          _statusE9Encoder.Encode(&_rangeEncoder, 0);
        else
          _statusJccEncoder.Encode(&_rangeEncoder, 0);
        bufferPos++;
        prevByte = b;
      }
    }
    nowPos += bufferPos;
    nowPos64 += bufferPos;

    if (progress != NULL)
    {
      RINOK(progress->SetRatioInfo(&nowPos64, NULL));
    }
 
    UInt32 i = 0;
    while(bufferPos < endPos)
      _buffer[i++] = _buffer[bufferPos++];
    bufferPos = i;
  }
}

STDMETHODIMP CBCJ2_x86_Encoder::Code(ISequentialInStream **inStreams,
      const UInt64 **inSizes,
      UInt32 numInStreams,
      ISequentialOutStream **outStreams,
      const UInt64 **outSizes,
      UInt32 numOutStreams,
      ICompressProgressInfo *progress)
{
  try
  {
    return CodeReal(inStreams, inSizes, numInStreams,
      outStreams, outSizes,numOutStreams, progress);
  }
  catch(const COutBufferException &e) { return e.ErrorCode; }
  catch(...) { return S_FALSE; }
}

#endif

HRESULT CBCJ2_x86_Decoder::CodeReal(ISequentialInStream **inStreams,
      const UInt64 **inSizes,
      UInt32 numInStreams,
      ISequentialOutStream **outStreams,
      const UInt64 **outSizes,
      UInt32 numOutStreams,
      ICompressProgressInfo *progress)
{
  if (numInStreams != 4 || numOutStreams != 1)
    return E_INVALIDARG;

  if (!_mainInStream.Create(1 << 16))
    return E_OUTOFMEMORY;
  if (!_callStream.Create(1 << 20))
    return E_OUTOFMEMORY;
  if (!_jumpStream.Create(1 << 16))
    return E_OUTOFMEMORY;
  if (!_rangeDecoder.Create(1 << 20))
    return E_OUTOFMEMORY;
  if (!_outStream.Create(1 << 16))
    return E_OUTOFMEMORY;

  _mainInStream.SetStream(inStreams[0]);
  _callStream.SetStream(inStreams[1]);
  _jumpStream.SetStream(inStreams[2]);
  _rangeDecoder.SetStream(inStreams[3]);
  _outStream.SetStream(outStreams[0]);

  _mainInStream.Init();
  _callStream.Init();
  _jumpStream.Init();
  _rangeDecoder.Init();
  _outStream.Init();

  for (int i = 0; i < 256; i++)
    _statusE8Decoder[i].Init();
  _statusE9Decoder.Init();
  _statusJccDecoder.Init();

  CCoderReleaser releaser(this);

  Byte prevByte = 0;
  UInt32 processedBytes = 0;
  while(true)
  {
    if (processedBytes > (1 << 20) && progress != NULL)
    {
      UInt64 nowPos64 = _outStream.GetProcessedSize();
      RINOK(progress->SetRatioInfo(NULL, &nowPos64));
      processedBytes = 0;
    }
    processedBytes++;
    Byte b;
    if (!_mainInStream.ReadByte(b))
      return Flush();
    _outStream.WriteByte(b);
    if (b != 0xE8 && b != 0xE9 && !IsJcc(prevByte, b))
    {
      prevByte = b;
      continue;
    }
    bool status;
    if (b == 0xE8)
      status = (_statusE8Decoder[prevByte].Decode(&_rangeDecoder) == 1);
    else if (b == 0xE9)
      status = (_statusE9Decoder.Decode(&_rangeDecoder) == 1);
    else
      status = (_statusJccDecoder.Decode(&_rangeDecoder) == 1);
    if (status)
    {
      UInt32 src;
      if (b == 0xE8)
      {
        Byte b0;
        if(!_callStream.ReadByte(b0))
          return S_FALSE;
        src = ((UInt32)b0) << 24;
        if(!_callStream.ReadByte(b0))
          return S_FALSE;
        src |= ((UInt32)b0) << 16;
        if(!_callStream.ReadByte(b0))
          return S_FALSE;
        src |= ((UInt32)b0) << 8;
        if(!_callStream.ReadByte(b0))
          return S_FALSE;
        src |= ((UInt32)b0);
      }
      else
      {
        Byte b0;
        if(!_jumpStream.ReadByte(b0))
          return S_FALSE;
        src = ((UInt32)b0) << 24;
        if(!_jumpStream.ReadByte(b0))
          return S_FALSE;
        src |= ((UInt32)b0) << 16;
        if(!_jumpStream.ReadByte(b0))
          return S_FALSE;
        src |= ((UInt32)b0) << 8;
        if(!_jumpStream.ReadByte(b0))
          return S_FALSE;
        src |= ((UInt32)b0);
      }
      UInt32 dest = src - (UInt32(_outStream.GetProcessedSize()) + 4) ;
      _outStream.WriteByte((Byte)(dest));
      _outStream.WriteByte((Byte)(dest >> 8));
      _outStream.WriteByte((Byte)(dest >> 16));
      _outStream.WriteByte((Byte)(dest >> 24));
      prevByte = (dest >> 24);
      processedBytes += 4;
    }
    else
      prevByte = b;
  }
}

STDMETHODIMP CBCJ2_x86_Decoder::Code(ISequentialInStream **inStreams,
      const UInt64 **inSizes,
      UInt32 numInStreams,
      ISequentialOutStream **outStreams,
      const UInt64 **outSizes,
      UInt32 numOutStreams,
      ICompressProgressInfo *progress)
{
  try
  {
    return CodeReal(inStreams, inSizes, numInStreams,
        outStreams, outSizes,numOutStreams, progress);
  }
  catch(const COutBufferException &e) { return e.ErrorCode; }
  catch(...) { return S_FALSE; }
}
