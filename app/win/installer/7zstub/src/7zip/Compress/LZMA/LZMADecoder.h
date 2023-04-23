// LZMA/Decoder.h

#ifndef __LZMA_DECODER_H
#define __LZMA_DECODER_H

#include "../../../Common/MyCom.h"
#include "../../../Common/Alloc.h"
#include "../../ICoder.h"
#include "../LZ/LZOutWindow.h"
#include "../RangeCoder/RangeCoderBitTree.h"

#include "LZMA.h"

namespace NCompress {
namespace NLZMA {

typedef NRangeCoder::CBitDecoder<kNumMoveBits> CMyBitDecoder;

class CLiteralDecoder2
{
  CMyBitDecoder _decoders[0x300];
public:
  void Init()
  {
    for (int i = 0; i < 0x300; i++)
      _decoders[i].Init();
  }
  Byte DecodeNormal(NRangeCoder::CDecoder *rangeDecoder)
  {
    UInt32 symbol = 1;
    RC_INIT_VAR
    do
    {
      // symbol = (symbol << 1) | _decoders[0][symbol].Decode(rangeDecoder);
      RC_GETBIT(kNumMoveBits, _decoders[symbol].Prob, symbol)
    }
    while (symbol < 0x100);
    RC_FLUSH_VAR
    return (Byte)symbol;
  }
  Byte DecodeWithMatchByte(NRangeCoder::CDecoder *rangeDecoder, Byte matchByte)
  {
    UInt32 symbol = 1;
    RC_INIT_VAR
    do
    {
      UInt32 matchBit = (matchByte >> 7) & 1;
      matchByte <<= 1;
      // UInt32 bit = _decoders[1 + matchBit][symbol].Decode(rangeDecoder);
      // symbol = (symbol << 1) | bit;
      UInt32 bit;
      RC_GETBIT2(kNumMoveBits, _decoders[0x100 + (matchBit << 8) + symbol].Prob, symbol, 
          bit = 0, bit = 1)
      if (matchBit != bit)
      {
        while (symbol < 0x100)
        {
          // symbol = (symbol << 1) | _decoders[0][symbol].Decode(rangeDecoder);
          RC_GETBIT(kNumMoveBits, _decoders[symbol].Prob, symbol)
        }
        break;
      }
    }
    while (symbol < 0x100);
    RC_FLUSH_VAR
    return (Byte)symbol;
  }
};

class CLiteralDecoder
{
  CLiteralDecoder2 *_coders;
  int _numPrevBits;
  int _numPosBits;
  UInt32 _posMask;
public:
  CLiteralDecoder(): _coders(0) {}
  ~CLiteralDecoder()  { Free(); }
  void Free()
  { 
    MyFree(_coders);
    _coders = 0;
  }
  bool Create(int numPosBits, int numPrevBits)
  {
    if (_coders == 0 || (numPosBits + numPrevBits) != 
        (_numPrevBits + _numPosBits) )
    {
      Free();
      UInt32 numStates = 1 << (numPosBits + numPrevBits);
      _coders = (CLiteralDecoder2 *)MyAlloc(numStates * sizeof(CLiteralDecoder2));
    }
    _numPosBits = numPosBits;
    _posMask = (1 << numPosBits) - 1;
    _numPrevBits = numPrevBits;
    return (_coders != 0);
  }
  void Init()
  {
    UInt32 numStates = 1 << (_numPrevBits + _numPosBits);
    for (UInt32 i = 0; i < numStates; i++)
      _coders[i].Init();
  }
  UInt32 GetState(UInt32 pos, Byte prevByte) const
    { return ((pos & _posMask) << _numPrevBits) + (prevByte >> (8 - _numPrevBits)); }
  Byte DecodeNormal(NRangeCoder::CDecoder *rangeDecoder, UInt32 pos, Byte prevByte)
    { return _coders[GetState(pos, prevByte)].DecodeNormal(rangeDecoder); }
  Byte DecodeWithMatchByte(NRangeCoder::CDecoder *rangeDecoder, UInt32 pos, Byte prevByte, Byte matchByte)
    { return _coders[GetState(pos, prevByte)].DecodeWithMatchByte(rangeDecoder, matchByte); }
};

namespace NLength {

class CDecoder
{
  CMyBitDecoder _choice;
  CMyBitDecoder _choice2;
  NRangeCoder::CBitTreeDecoder<kNumMoveBits, kNumLowBits>  _lowCoder[kNumPosStatesMax];
  NRangeCoder::CBitTreeDecoder<kNumMoveBits, kNumMidBits>  _midCoder[kNumPosStatesMax];
  NRangeCoder::CBitTreeDecoder<kNumMoveBits, kNumHighBits> _highCoder; 
public:
  void Init(UInt32 numPosStates)
  {
    _choice.Init();
    _choice2.Init();
    for (UInt32 posState = 0; posState < numPosStates; posState++)
    {
      _lowCoder[posState].Init();
      _midCoder[posState].Init();
    }
    _highCoder.Init();
  }
  UInt32 Decode(NRangeCoder::CDecoder *rangeDecoder, UInt32 posState)
  {
    if(_choice.Decode(rangeDecoder) == 0)
      return _lowCoder[posState].Decode(rangeDecoder);
    if(_choice2.Decode(rangeDecoder) == 0)
      return kNumLowSymbols + _midCoder[posState].Decode(rangeDecoder);
    return kNumLowSymbols + kNumMidSymbols + _highCoder.Decode(rangeDecoder);
  }
};

}

class CDecoder: 
  public ICompressCoder,
  public ICompressSetDecoderProperties2,
  public ICompressGetInStreamProcessedSize,
  #ifdef _ST_MODE
  public ICompressSetInStream,
  public ICompressSetOutStreamSize,
  public ISequentialInStream,
  #endif
  public CMyUnknownImp
{
  CLZOutWindow _outWindowStream;
  NRangeCoder::CDecoder _rangeDecoder;

  CMyBitDecoder _isMatch[kNumStates][NLength::kNumPosStatesMax];
  CMyBitDecoder _isRep[kNumStates];
  CMyBitDecoder _isRepG0[kNumStates];
  CMyBitDecoder _isRepG1[kNumStates];
  CMyBitDecoder _isRepG2[kNumStates];
  CMyBitDecoder _isRep0Long[kNumStates][NLength::kNumPosStatesMax];

  NRangeCoder::CBitTreeDecoder<kNumMoveBits, kNumPosSlotBits> _posSlotDecoder[kNumLenToPosStates];

  CMyBitDecoder _posDecoders[kNumFullDistances - kEndPosModelIndex];
  NRangeCoder::CBitTreeDecoder<kNumMoveBits, kNumAlignBits> _posAlignDecoder;
  
  NLength::CDecoder _lenDecoder;
  NLength::CDecoder _repMatchLenDecoder;

  CLiteralDecoder _literalDecoder;

  UInt32 _posStateMask;

  ///////////////////
  // State
  UInt32 _reps[4];
  CState _state;
  Int32 _remainLen; // -1 means end of stream. // -2 means need Init
  UInt64 _outSize;
  bool _outSizeDefined;

  void Init();
  HRESULT CodeSpec(UInt32 size);
public:

  #ifdef _ST_MODE
  MY_UNKNOWN_IMP5(
      ICompressSetDecoderProperties2, 
      ICompressGetInStreamProcessedSize,
      ICompressSetInStream, 
      ICompressSetOutStreamSize, 
      ISequentialInStream)
  #else
  MY_UNKNOWN_IMP2(
      ICompressSetDecoderProperties2,
      ICompressGetInStreamProcessedSize)
  #endif

  void ReleaseStreams()
  {
    _outWindowStream.ReleaseStream();
    ReleaseInStream();
  }

  class CDecoderFlusher
  {
    CDecoder *_decoder;
  public:
    bool NeedFlush;
    CDecoderFlusher(CDecoder *decoder): _decoder(decoder), NeedFlush(true) {}
    ~CDecoderFlusher() 
    { 
      if (NeedFlush)
        _decoder->Flush();
      _decoder->ReleaseStreams(); 
    }
  };

  HRESULT Flush() {  return _outWindowStream.Flush(); }  

  STDMETHOD(CodeReal)(ISequentialInStream *inStream,
      ISequentialOutStream *outStream, const UInt64 *inSize, const UInt64 *outSize,
      ICompressProgressInfo *progress);
  
  STDMETHOD(Code)(ISequentialInStream *inStream,
      ISequentialOutStream *outStream, const UInt64 *inSize, const UInt64 *outSize,
      ICompressProgressInfo *progress);

  STDMETHOD(SetDecoderProperties2)(const Byte *data, UInt32 size);

  STDMETHOD(GetInStreamProcessedSize)(UInt64 *value);

  STDMETHOD(SetInStream)(ISequentialInStream *inStream);
  STDMETHOD(ReleaseInStream)();
  STDMETHOD(SetOutStreamSize)(const UInt64 *outSize);

  #ifdef _ST_MODE
  STDMETHOD(Read)(void *data, UInt32 size, UInt32 *processedSize);
  #endif

  CDecoder(): _outSizeDefined(false) {}
  virtual ~CDecoder() {}
};

}}

#endif
