// Compress/RangeCoder/RangeCoderBitTree.h

#ifndef __COMPRESS_RANGECODER_BIT_TREE_H
#define __COMPRESS_RANGECODER_BIT_TREE_H

#include "RangeCoderBit.h"
#include "RangeCoderOpt.h"

namespace NCompress {
namespace NRangeCoder {

template <int numMoveBits, int NumBitLevels>
class CBitTreeEncoder
{
  CBitEncoder<numMoveBits> Models[1 << NumBitLevels];
public:
  void Init()
  {
    for(UInt32 i = 1; i < (1 << NumBitLevels); i++)
      Models[i].Init();
  }
  void Encode(CEncoder *rangeEncoder, UInt32 symbol)
  {
    UInt32 modelIndex = 1;
    for (int bitIndex = NumBitLevels; bitIndex != 0 ;)
    {
      bitIndex--;
      UInt32 bit = (symbol >> bitIndex) & 1;
      Models[modelIndex].Encode(rangeEncoder, bit);
      modelIndex = (modelIndex << 1) | bit;
    }
  };
  void ReverseEncode(CEncoder *rangeEncoder, UInt32 symbol)
  {
    UInt32 modelIndex = 1;
    for (int i = 0; i < NumBitLevels; i++)
    {
      UInt32 bit = symbol & 1;
      Models[modelIndex].Encode(rangeEncoder, bit);
      modelIndex = (modelIndex << 1) | bit;
      symbol >>= 1;
    }
  }
  UInt32 GetPrice(UInt32 symbol) const
  {
    symbol |= (1 << NumBitLevels);
    UInt32 price = 0;
    while (symbol != 1)
    {
      price += Models[symbol >> 1].GetPrice(symbol & 1);
      symbol >>= 1;
    }
    return price;
  }
  UInt32 ReverseGetPrice(UInt32 symbol) const
  {
    UInt32 price = 0;
    UInt32 modelIndex = 1;
    for (int i = NumBitLevels; i != 0; i--)
    {
      UInt32 bit = symbol & 1;
      symbol >>= 1;
      price += Models[modelIndex].GetPrice(bit);
      modelIndex = (modelIndex << 1) | bit;
    }
    return price;
  }
};

template <int numMoveBits, int NumBitLevels>
class CBitTreeDecoder
{
  CBitDecoder<numMoveBits> Models[1 << NumBitLevels];
public:
  void Init()
  {
    for(UInt32 i = 1; i < (1 << NumBitLevels); i++)
      Models[i].Init();
  }
  UInt32 Decode(CDecoder *rangeDecoder)
  {
    UInt32 modelIndex = 1;
    RC_INIT_VAR
    for(int bitIndex = NumBitLevels; bitIndex != 0; bitIndex--)
    {
      // modelIndex = (modelIndex << 1) + Models[modelIndex].Decode(rangeDecoder);
      RC_GETBIT(numMoveBits, Models[modelIndex].Prob, modelIndex)
    }
    RC_FLUSH_VAR
    return modelIndex - (1 << NumBitLevels);
  };
  UInt32 ReverseDecode(CDecoder *rangeDecoder)
  {
    UInt32 modelIndex = 1;
    UInt32 symbol = 0;
    RC_INIT_VAR
    for(int bitIndex = 0; bitIndex < NumBitLevels; bitIndex++)
    {
      // UInt32 bit = Models[modelIndex].Decode(rangeDecoder);
      // modelIndex <<= 1;
      // modelIndex += bit;
      // symbol |= (bit << bitIndex);
      RC_GETBIT2(numMoveBits, Models[modelIndex].Prob, modelIndex, ; , symbol |= (1 << bitIndex))
    }
    RC_FLUSH_VAR
    return symbol;
  }
};

template <int numMoveBits>
void ReverseBitTreeEncode(CBitEncoder<numMoveBits> *Models, 
    CEncoder *rangeEncoder, int NumBitLevels, UInt32 symbol)
{
  UInt32 modelIndex = 1;
  for (int i = 0; i < NumBitLevels; i++)
  {
    UInt32 bit = symbol & 1;
    Models[modelIndex].Encode(rangeEncoder, bit);
    modelIndex = (modelIndex << 1) | bit;
    symbol >>= 1;
  }
}

template <int numMoveBits>
UInt32 ReverseBitTreeGetPrice(CBitEncoder<numMoveBits> *Models, 
    UInt32 NumBitLevels, UInt32 symbol)
{
  UInt32 price = 0;
  UInt32 modelIndex = 1;
  for (int i = NumBitLevels; i != 0; i--)
  {
    UInt32 bit = symbol & 1;
    symbol >>= 1;
    price += Models[modelIndex].GetPrice(bit);
    modelIndex = (modelIndex << 1) | bit;
  }
  return price;
}

template <int numMoveBits>
UInt32 ReverseBitTreeDecode(CBitDecoder<numMoveBits> *Models, 
    CDecoder *rangeDecoder, int NumBitLevels)
{
  UInt32 modelIndex = 1;
  UInt32 symbol = 0;
  RC_INIT_VAR
  for(int bitIndex = 0; bitIndex < NumBitLevels; bitIndex++)
  {
    // UInt32 bit = Models[modelIndex].Decode(rangeDecoder);
    // modelIndex <<= 1;
    // modelIndex += bit;
    // symbol |= (bit << bitIndex);
    RC_GETBIT2(numMoveBits, Models[modelIndex].Prob, modelIndex, ; , symbol |= (1 << bitIndex))
  }
  RC_FLUSH_VAR
  return symbol;
}

}}

#endif
