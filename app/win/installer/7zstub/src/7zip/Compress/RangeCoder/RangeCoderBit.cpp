// Compress/RangeCoder/RangeCoderBit.cpp

#include "StdAfx.h"

#include "RangeCoderBit.h"

namespace NCompress {
namespace NRangeCoder {

UInt32 CPriceTables::ProbPrices[kBitModelTotal >> kNumMoveReducingBits];
static CPriceTables g_PriceTables;

CPriceTables::CPriceTables() { Init(); }

void CPriceTables::Init()
{
  const int kNumBits = (kNumBitModelTotalBits - kNumMoveReducingBits);
  for(int i = kNumBits - 1; i >= 0; i--)
  {
    UInt32 start = 1 << (kNumBits - i - 1);
    UInt32 end = 1 << (kNumBits - i);
    for (UInt32 j = start; j < end; j++)
      ProbPrices[j] = (i << kNumBitPriceShiftBits) + 
          (((end - j) << kNumBitPriceShiftBits) >> (kNumBits - i - 1));
  }

  /*
  // simplest: bad solution
  for(UInt32 i = 1; i < (kBitModelTotal >> kNumMoveReducingBits) - 1; i++)
    ProbPrices[i] = kBitPrice;
  */
  
  /*
  const double kDummyMultMid = (1.0 / kBitPrice) / 2;
  const double kDummyMultMid = 0;
  // float solution
  double ln2 = log(double(2));
  double lnAll = log(double(kBitModelTotal >> kNumMoveReducingBits));
  for(UInt32 i = 1; i < (kBitModelTotal >> kNumMoveReducingBits) - 1; i++)
    ProbPrices[i] = UInt32((fabs(lnAll - log(double(i))) / ln2 + kDummyMultMid) * kBitPrice);
  */
  
  /*
  // experimental, slow, solution:
  for(UInt32 i = 1; i < (kBitModelTotal >> kNumMoveReducingBits) - 1; i++)
  {
    const int kCyclesBits = 5;
    const UInt32 kCycles = (1 << kCyclesBits);

    UInt32 range = UInt32(-1);
    UInt32 bitCount = 0;
    for (UInt32 j = 0; j < kCycles; j++)
    {
      range >>= (kNumBitModelTotalBits - kNumMoveReducingBits);
      range *= i;
      while(range < (1 << 31))
      {
        range <<= 1;
        bitCount++;
      }
    }
    bitCount <<= kNumBitPriceShiftBits;
    range -= (1 << 31);
    for (int k = kNumBitPriceShiftBits - 1; k >= 0; k--)
    {
      range <<= 1;
      if (range > (1 << 31))
      {
        bitCount += (1 << k);
        range -= (1 << 31);
      }
    }
    ProbPrices[i] = (bitCount 
      // + (1 << (kCyclesBits - 1))
      ) >> kCyclesBits;
  }
  */
}

}}
