// LZMA.h

#ifndef __LZMA_H
#define __LZMA_H

namespace NCompress {
namespace NLZMA {

const UInt32 kNumRepDistances = 4;

const int kNumStates = 12;

const Byte kLiteralNextStates[kNumStates] = {0, 0, 0, 0, 1, 2, 3, 4,  5,  6,   4, 5};
const Byte kMatchNextStates[kNumStates]   = {7, 7, 7, 7, 7, 7, 7, 10, 10, 10, 10, 10};
const Byte kRepNextStates[kNumStates]     = {8, 8, 8, 8, 8, 8, 8, 11, 11, 11, 11, 11};
const Byte kShortRepNextStates[kNumStates]= {9, 9, 9, 9, 9, 9, 9, 11, 11, 11, 11, 11};

class CState
{
public:
  Byte Index;
  void Init() { Index = 0; }
  void UpdateChar() { Index = kLiteralNextStates[Index]; }
  void UpdateMatch() { Index = kMatchNextStates[Index]; }
  void UpdateRep() { Index = kRepNextStates[Index]; }
  void UpdateShortRep() { Index = kShortRepNextStates[Index]; }
  bool IsCharState() const { return Index < 7; }
};

const int kNumPosSlotBits = 6; 
const int kDicLogSizeMin = 0; 
const int kDicLogSizeMax = 32; 
const int kDistTableSizeMax = kDicLogSizeMax * 2; 

const UInt32 kNumLenToPosStates = 4;

inline UInt32 GetLenToPosState(UInt32 len)
{
  len -= 2;
  if (len < kNumLenToPosStates)
    return len;
  return kNumLenToPosStates - 1;
}

namespace NLength {

const int kNumPosStatesBitsMax = 4;
const UInt32 kNumPosStatesMax = (1 << kNumPosStatesBitsMax);

const int kNumPosStatesBitsEncodingMax = 4;
const UInt32 kNumPosStatesEncodingMax = (1 << kNumPosStatesBitsEncodingMax);

const int kNumLowBits = 3;
const int kNumMidBits = 3;
const int kNumHighBits = 8;
const UInt32 kNumLowSymbols = 1 << kNumLowBits;
const UInt32 kNumMidSymbols = 1 << kNumMidBits;
const UInt32 kNumSymbolsTotal = kNumLowSymbols + kNumMidSymbols + (1 << kNumHighBits);

}

const UInt32 kMatchMinLen = 2;
const UInt32 kMatchMaxLen = kMatchMinLen + NLength::kNumSymbolsTotal - 1;

const int kNumAlignBits = 4;
const UInt32 kAlignTableSize = 1 << kNumAlignBits;
const UInt32 kAlignMask = (kAlignTableSize - 1);

const UInt32 kStartPosModelIndex = 4;
const UInt32 kEndPosModelIndex = 14;
const UInt32 kNumPosModels = kEndPosModelIndex - kStartPosModelIndex;

const UInt32 kNumFullDistances = 1 << (kEndPosModelIndex / 2);

const int kNumLitPosStatesBitsEncodingMax = 4;
const int kNumLitContextBitsMax = 8;

const int kNumMoveBits = 5;

}}

#endif
