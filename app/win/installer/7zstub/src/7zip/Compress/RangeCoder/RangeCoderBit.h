// Compress/RangeCoder/RangeCoderBit.h

#ifndef __COMPRESS_RANGECODER_BIT_H
#define __COMPRESS_RANGECODER_BIT_H

#include "RangeCoder.h"

namespace NCompress {
namespace NRangeCoder {

const int kNumBitModelTotalBits  = 11;
const UInt32 kBitModelTotal = (1 << kNumBitModelTotalBits);

const int kNumMoveReducingBits = 2;

const int kNumBitPriceShiftBits = 6;
const UInt32 kBitPrice = 1 << kNumBitPriceShiftBits;

class CPriceTables
{
public:
  static UInt32 ProbPrices[kBitModelTotal >> kNumMoveReducingBits];
  static void Init();
  CPriceTables();
};

template <int numMoveBits>
class CBitModel
{
public:
  UInt32 Prob;
  void UpdateModel(UInt32 symbol)
  {
    /*
    Prob -= (Prob + ((symbol - 1) & ((1 << numMoveBits) - 1))) >> numMoveBits;
    Prob += (1 - symbol) << (kNumBitModelTotalBits - numMoveBits);
    */
    if (symbol == 0)
      Prob += (kBitModelTotal - Prob) >> numMoveBits;
    else
      Prob -= (Prob) >> numMoveBits;
  }
public:
  void Init() { Prob = kBitModelTotal / 2; }
};

template <int numMoveBits>
class CBitEncoder: public CBitModel<numMoveBits>
{
public:
  void Encode(CEncoder *encoder, UInt32 symbol)
  {
    /*
    encoder->EncodeBit(this->Prob, kNumBitModelTotalBits, symbol);
    this->UpdateModel(symbol);
    */
    UInt32 newBound = (encoder->Range >> kNumBitModelTotalBits) * this->Prob;
    if (symbol == 0)
    {
      encoder->Range = newBound;
      this->Prob += (kBitModelTotal - this->Prob) >> numMoveBits;
    }
    else
    {
      encoder->Low += newBound;
      encoder->Range -= newBound;
      this->Prob -= (this->Prob) >> numMoveBits;
    }
    if (encoder->Range < kTopValue)
    {
      encoder->Range <<= 8;
      encoder->ShiftLow();
    }
  }
  UInt32 GetPrice(UInt32 symbol) const
  {
    return CPriceTables::ProbPrices[
      (((this->Prob - symbol) ^ ((-(int)symbol))) & (kBitModelTotal - 1)) >> kNumMoveReducingBits];
  }
  UInt32 GetPrice0() const { return CPriceTables::ProbPrices[this->Prob >> kNumMoveReducingBits]; }
  UInt32 GetPrice1() const { return CPriceTables::ProbPrices[(kBitModelTotal - this->Prob) >> kNumMoveReducingBits]; }
};


template <int numMoveBits>
class CBitDecoder: public CBitModel<numMoveBits>
{
public:
  UInt32 Decode(CDecoder *decoder)
  {
    UInt32 newBound = (decoder->Range >> kNumBitModelTotalBits) * this->Prob;
    if (decoder->Code < newBound)
    {
      decoder->Range = newBound;
      this->Prob += (kBitModelTotal - this->Prob) >> numMoveBits;
      if (decoder->Range < kTopValue)
      {
        decoder->Code = (decoder->Code << 8) | decoder->Stream.ReadByte();
        decoder->Range <<= 8;
      }
      return 0;
    }
    else
    {
      decoder->Range -= newBound;
      decoder->Code -= newBound;
      this->Prob -= (this->Prob) >> numMoveBits;
      if (decoder->Range < kTopValue)
      {
        decoder->Code = (decoder->Code << 8) | decoder->Stream.ReadByte();
        decoder->Range <<= 8;
      }
      return 1;
    }
  }
};

}}

#endif
