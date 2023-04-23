// LZMADecoder.cpp

#include "StdAfx.h"

#include "LZMADecoder.h"
#include "../../../Common/Defs.h"

namespace NCompress {
namespace NLZMA {

const int kLenIdFinished = -1;
const int kLenIdNeedInit = -2;

void CDecoder::Init()
{
  { 
    for(int i = 0; i < kNumStates; i++)
    {
      for (UInt32 j = 0; j <= _posStateMask; j++)
      {
        _isMatch[i][j].Init();
        _isRep0Long[i][j].Init();
      }
      _isRep[i].Init();
      _isRepG0[i].Init();
      _isRepG1[i].Init();
      _isRepG2[i].Init();
    }
  }
  { 
    for (UInt32 i = 0; i < kNumLenToPosStates; i++)
    _posSlotDecoder[i].Init();
  }
  { 
    for(UInt32 i = 0; i < kNumFullDistances - kEndPosModelIndex; i++)
      _posDecoders[i].Init();
  }
  _posAlignDecoder.Init();
  _lenDecoder.Init(_posStateMask + 1);
  _repMatchLenDecoder.Init(_posStateMask + 1);
  _literalDecoder.Init();

  _state.Init();
  _reps[0] = _reps[1] = _reps[2] = _reps[3] = 0;
}

HRESULT CDecoder::CodeSpec(UInt32 curSize)
{
  if (_outSizeDefined)
  {
    const UInt64 rem = _outSize - _outWindowStream.GetProcessedSize();
    if (curSize > rem)
      curSize = (UInt32)rem;
  }

  if (_remainLen == kLenIdFinished)
    return S_OK;
  if (_remainLen == kLenIdNeedInit)
  {
    _rangeDecoder.Init();
    Init();
    _remainLen = 0;
  }
  if (curSize == 0)
    return S_OK;

  UInt32 rep0 = _reps[0];
  UInt32 rep1 = _reps[1];
  UInt32 rep2 = _reps[2];
  UInt32 rep3 = _reps[3];
  CState state = _state;
  Byte previousByte;

  while(_remainLen > 0 && curSize > 0)
  {
    previousByte = _outWindowStream.GetByte(rep0);
    _outWindowStream.PutByte(previousByte);
    _remainLen--;
    curSize--;
  }
  UInt64 nowPos64 = _outWindowStream.GetProcessedSize();
  if (nowPos64 == 0)
    previousByte = 0;
  else
    previousByte = _outWindowStream.GetByte(0);

  while(curSize > 0)
  {
    {
      #ifdef _NO_EXCEPTIONS
      if (_rangeDecoder.Stream.ErrorCode != S_OK)
        return _rangeDecoder.Stream.ErrorCode;
      #endif
      if (_rangeDecoder.Stream.WasFinished())
        return S_FALSE;
      UInt32 posState = UInt32(nowPos64) & _posStateMask;
      if (_isMatch[state.Index][posState].Decode(&_rangeDecoder) == 0)
      {
        if(!state.IsCharState())
          previousByte = _literalDecoder.DecodeWithMatchByte(&_rangeDecoder, 
              (UInt32)nowPos64, previousByte, _outWindowStream.GetByte(rep0));
        else
          previousByte = _literalDecoder.DecodeNormal(&_rangeDecoder, 
              (UInt32)nowPos64, previousByte);
        _outWindowStream.PutByte(previousByte);
        state.UpdateChar();
        curSize--;
        nowPos64++;
      }
      else             
      {
        UInt32 len;
        if(_isRep[state.Index].Decode(&_rangeDecoder) == 1)
        {
          len = 0;
          if(_isRepG0[state.Index].Decode(&_rangeDecoder) == 0)
          {
            if(_isRep0Long[state.Index][posState].Decode(&_rangeDecoder) == 0)
            {
              state.UpdateShortRep();
              len = 1;
            }
          }
          else
          {
            UInt32 distance;
            if(_isRepG1[state.Index].Decode(&_rangeDecoder) == 0)
              distance = rep1;
            else 
            {
              if (_isRepG2[state.Index].Decode(&_rangeDecoder) == 0)
                distance = rep2;
              else
              {
                distance = rep3;
                rep3 = rep2;
              }
              rep2 = rep1;
            }
            rep1 = rep0;
            rep0 = distance;
          }
          if (len == 0)
          {
            len = _repMatchLenDecoder.Decode(&_rangeDecoder, posState) + kMatchMinLen;
            state.UpdateRep();
          }
        }
        else
        {
          rep3 = rep2;
          rep2 = rep1;
          rep1 = rep0;
          len = kMatchMinLen + _lenDecoder.Decode(&_rangeDecoder, posState);
          state.UpdateMatch();
          UInt32 posSlot = _posSlotDecoder[GetLenToPosState(len)].Decode(&_rangeDecoder);
          if (posSlot >= kStartPosModelIndex)
          {
            UInt32 numDirectBits = (posSlot >> 1) - 1;
            rep0 = ((2 | (posSlot & 1)) << numDirectBits);

            if (posSlot < kEndPosModelIndex)
              rep0 += NRangeCoder::ReverseBitTreeDecode(_posDecoders + 
                  rep0 - posSlot - 1, &_rangeDecoder, numDirectBits);
            else
            {
              rep0 += (_rangeDecoder.DecodeDirectBits(
                  numDirectBits - kNumAlignBits) << kNumAlignBits);
              rep0 += _posAlignDecoder.ReverseDecode(&_rangeDecoder);
              if (rep0 == 0xFFFFFFFF)
              {
                _remainLen = kLenIdFinished;
                return S_OK;
              }
            }
          }
          else
            rep0 = posSlot;
        }
        UInt32 locLen = len;
        if (len > curSize)
          locLen = (UInt32)curSize;
        if (!_outWindowStream.CopyBlock(rep0, locLen))
          return S_FALSE;
        previousByte = _outWindowStream.GetByte(0);
        curSize -= locLen;
        nowPos64 += locLen;
        len -= locLen;
        if (len != 0)
        {
          _remainLen = (Int32)len;
          break;
        }

        #ifdef _NO_EXCEPTIONS
        if (_outWindowStream.ErrorCode != S_OK)
          return _outWindowStream.ErrorCode;
        #endif
      }
    }
  }
  if (_rangeDecoder.Stream.WasFinished())
    return S_FALSE;
  _reps[0] = rep0;
  _reps[1] = rep1;
  _reps[2] = rep2;
  _reps[3] = rep3;
  _state = state;

  return S_OK;
}

STDMETHODIMP CDecoder::CodeReal(ISequentialInStream *inStream,
    ISequentialOutStream *outStream, 
    const UInt64 *, const UInt64 *outSize,
    ICompressProgressInfo *progress)
{
  SetInStream(inStream);
  _outWindowStream.SetStream(outStream);
  SetOutStreamSize(outSize);
  CDecoderFlusher flusher(this);

  while (true)
  {
    UInt32 curSize = 1 << 18;
    RINOK(CodeSpec(curSize));
    if (_remainLen == kLenIdFinished)
      break;
    if (progress != NULL)
    {
      UInt64 inSize = _rangeDecoder.GetProcessedSize();
      UInt64 nowPos64 = _outWindowStream.GetProcessedSize();
      RINOK(progress->SetRatioInfo(&inSize, &nowPos64));
    }
    if (_outSizeDefined)
      if (_outWindowStream.GetProcessedSize() >= _outSize)
        break;
  } 
  flusher.NeedFlush = false;
  return Flush();
}


#ifdef _NO_EXCEPTIONS

#define LZMA_TRY_BEGIN
#define LZMA_TRY_END

#else

#define LZMA_TRY_BEGIN try { 
#define LZMA_TRY_END } \
  catch(const CInBufferException &e)  { return e.ErrorCode; } \
  catch(const CLZOutWindowException &e)  { return e.ErrorCode; } \
  catch(...) { return S_FALSE; }

#endif


STDMETHODIMP CDecoder::Code(ISequentialInStream *inStream,
      ISequentialOutStream *outStream, const UInt64 *inSize, const UInt64 *outSize,
      ICompressProgressInfo *progress)
{
  LZMA_TRY_BEGIN
  return CodeReal(inStream, outStream, inSize, outSize, progress); 
  LZMA_TRY_END
}

STDMETHODIMP CDecoder::SetDecoderProperties2(const Byte *properties, UInt32 size)
{
  if (size < 5)
    return E_INVALIDARG;
  int lc = properties[0] % 9;
  Byte remainder = (Byte)(properties[0] / 9);
  int lp = remainder % 5;
  int pb = remainder / 5;
  if (pb > NLength::kNumPosStatesBitsMax)
    return E_INVALIDARG;
  _posStateMask = (1 << pb) - 1;
  UInt32 dictionarySize = 0;
  for (int i = 0; i < 4; i++)
    dictionarySize += ((UInt32)(properties[1 + i])) << (i * 8);
  if (!_outWindowStream.Create(dictionarySize))
    return E_OUTOFMEMORY;
  if (!_literalDecoder.Create(lp, lc))
    return E_OUTOFMEMORY;
  if (!_rangeDecoder.Create(1 << 20))
    return E_OUTOFMEMORY;
  return S_OK;
}

STDMETHODIMP CDecoder::GetInStreamProcessedSize(UInt64 *value)
{
  *value = _rangeDecoder.GetProcessedSize();
  return S_OK;
}

STDMETHODIMP CDecoder::SetInStream(ISequentialInStream *inStream)
{
  _rangeDecoder.SetStream(inStream);
  return S_OK;
}

STDMETHODIMP CDecoder::ReleaseInStream()
{
  _rangeDecoder.ReleaseStream();
  return S_OK;
}

STDMETHODIMP CDecoder::SetOutStreamSize(const UInt64 *outSize)
{
  if (_outSizeDefined = (outSize != NULL))
    _outSize = *outSize;
  _remainLen = kLenIdNeedInit;
  _outWindowStream.Init();
  return S_OK;
}

#ifdef _ST_MODE

STDMETHODIMP CDecoder::Read(void *data, UInt32 size, UInt32 *processedSize)
{
  LZMA_TRY_BEGIN
  if (processedSize)
    *processedSize = 0;
  const UInt64 startPos = _outWindowStream.GetProcessedSize();
  _outWindowStream.SetMemStream((Byte *)data);
  RINOK(CodeSpec(size));
  if (processedSize)
    *processedSize = (UInt32)(_outWindowStream.GetProcessedSize() - startPos);
  return Flush();
  LZMA_TRY_END
}

#endif

}}
