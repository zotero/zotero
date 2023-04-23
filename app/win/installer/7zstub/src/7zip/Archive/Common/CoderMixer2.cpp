// CoderMixer2.cpp

#include "StdAfx.h"

#include "CoderMixer2.h"

namespace NCoderMixer2 {

CBindReverseConverter::CBindReverseConverter(const CBindInfo &srcBindInfo):
  _srcBindInfo(srcBindInfo)
{
  srcBindInfo.GetNumStreams(NumSrcInStreams, _numSrcOutStreams);

  UInt32  j;
  for (j = 0; j < NumSrcInStreams; j++)
  {
    _srcInToDestOutMap.Add(0);
    DestOutToSrcInMap.Add(0);
  }
  for (j = 0; j < _numSrcOutStreams; j++)
  {
    _srcOutToDestInMap.Add(0);
    _destInToSrcOutMap.Add(0);
  }

  UInt32 destInOffset = 0;
  UInt32 destOutOffset = 0;
  UInt32 srcInOffset = NumSrcInStreams;
  UInt32 srcOutOffset = _numSrcOutStreams;

  for (int i = srcBindInfo.Coders.Size() - 1; i >= 0; i--)
  {
    const CCoderStreamsInfo &srcCoderInfo = srcBindInfo.Coders[i];

    srcInOffset -= srcCoderInfo.NumInStreams;
    srcOutOffset -= srcCoderInfo.NumOutStreams;
    
    UInt32 j;
    for (j = 0; j < srcCoderInfo.NumInStreams; j++, destOutOffset++)
    {
      UInt32 index = srcInOffset + j;
      _srcInToDestOutMap[index] = destOutOffset;
      DestOutToSrcInMap[destOutOffset] = index;
    }
    for (j = 0; j < srcCoderInfo.NumOutStreams; j++, destInOffset++)
    {
      UInt32 index = srcOutOffset + j;
      _srcOutToDestInMap[index] = destInOffset;
      _destInToSrcOutMap[destInOffset] = index;
    }
  }
}

void CBindReverseConverter::CreateReverseBindInfo(CBindInfo &destBindInfo)
{
  destBindInfo.Coders.Clear();
  destBindInfo.BindPairs.Clear();
  destBindInfo.InStreams.Clear();
  destBindInfo.OutStreams.Clear();

  int i;
  for (i = _srcBindInfo.Coders.Size() - 1; i >= 0; i--)
  {
    const CCoderStreamsInfo &srcCoderInfo = _srcBindInfo.Coders[i];
    CCoderStreamsInfo destCoderInfo;
    destCoderInfo.NumInStreams = srcCoderInfo.NumOutStreams;
    destCoderInfo.NumOutStreams = srcCoderInfo.NumInStreams;
    destBindInfo.Coders.Add(destCoderInfo);
  }
  for (i = _srcBindInfo.BindPairs.Size() - 1; i >= 0; i--)
  {
    const CBindPair &srcBindPair = _srcBindInfo.BindPairs[i];
    CBindPair destBindPair;
    destBindPair.InIndex = _srcOutToDestInMap[srcBindPair.OutIndex];
    destBindPair.OutIndex = _srcInToDestOutMap[srcBindPair.InIndex];
    destBindInfo.BindPairs.Add(destBindPair);
  }
  for (i = 0; i < _srcBindInfo.InStreams.Size(); i++)
    destBindInfo.OutStreams.Add(_srcInToDestOutMap[_srcBindInfo.InStreams[i]]);
  for (i = 0; i < _srcBindInfo.OutStreams.Size(); i++)
    destBindInfo.InStreams.Add(_srcOutToDestInMap[_srcBindInfo.OutStreams[i]]);
}

CCoderInfo::CCoderInfo(UInt32 numInStreams, UInt32 numOutStreams): 
    NumInStreams(numInStreams),
    NumOutStreams(numOutStreams)
{
  InSizes.Reserve(NumInStreams);
  InSizePointers.Reserve(NumInStreams);
  OutSizePointers.Reserve(NumOutStreams);
  OutSizePointers.Reserve(NumOutStreams);
}

static void SetSizes(const UInt64 **srcSizes, CRecordVector<UInt64> &sizes, 
    CRecordVector<const UInt64 *> &sizePointers, UInt32 numItems)
{
  sizes.Clear();
  sizePointers.Clear();
  for(UInt32 i = 0; i < numItems; i++)
  {
    if (srcSizes == 0 || srcSizes[i] == NULL)
    {
      sizes.Add(0);
      sizePointers.Add(NULL);
    }
    else
    {
      sizes.Add(*srcSizes[i]);
      sizePointers.Add(&sizes.Back());
    }
  }
}

void CCoderInfo::SetCoderInfo(const UInt64 **inSizes,
      const UInt64 **outSizes)
{
  SetSizes(inSizes, InSizes, InSizePointers, NumInStreams);
  SetSizes(outSizes, OutSizes, OutSizePointers, NumOutStreams);
}

}  
