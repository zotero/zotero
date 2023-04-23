// CoderMixer2.h

#ifndef __CODER_MIXER2_H
#define __CODER_MIXER2_H

#include "../../../Common/Vector.h"
#include "../../../Common/Types.h"
#include "../../../Common/MyCom.h"
#include "../../ICoder.h"

namespace NCoderMixer2 {

struct CBindPair
{
  UInt32 InIndex;
  UInt32 OutIndex;
};

struct CCoderStreamsInfo
{
  UInt32 NumInStreams;
  UInt32 NumOutStreams;
};

struct CBindInfo
{
  CRecordVector<CCoderStreamsInfo> Coders;
  CRecordVector<CBindPair> BindPairs;
  CRecordVector<UInt32> InStreams;
  CRecordVector<UInt32> OutStreams;

  void Clear()
  {
    Coders.Clear();
    BindPairs.Clear();
    InStreams.Clear();
    OutStreams.Clear();
  }

  /*
  UInt32 GetCoderStartOutStream(UInt32 coderIndex) const
  {
    UInt32 numOutStreams = 0;
    for (UInt32 i = 0; i < coderIndex; i++)
      numOutStreams += Coders[i].NumOutStreams;
    return numOutStreams;
  }
  */


  void GetNumStreams(UInt32 &numInStreams, UInt32 &numOutStreams) const
  {
    numInStreams = 0;
    numOutStreams = 0;
    for (int i = 0; i < Coders.Size(); i++)
    {
      const CCoderStreamsInfo &coderStreamsInfo = Coders[i];
      numInStreams += coderStreamsInfo.NumInStreams;
      numOutStreams += coderStreamsInfo.NumOutStreams;
    }
  }

  int FindBinderForInStream(UInt32 inStream) const
  {
    for (int i = 0; i < BindPairs.Size(); i++)
      if (BindPairs[i].InIndex == inStream)
        return i;
    return -1;
  }
  int FindBinderForOutStream(UInt32 outStream) const
  {
    for (int i = 0; i < BindPairs.Size(); i++)
      if (BindPairs[i].OutIndex == outStream)
        return i;
    return -1;
  }

  UInt32 GetCoderInStreamIndex(UInt32 coderIndex) const
  {
    UInt32 streamIndex = 0;
    for (UInt32 i = 0; i < coderIndex; i++)
      streamIndex += Coders[i].NumInStreams;
    return streamIndex;
  }

  UInt32 GetCoderOutStreamIndex(UInt32 coderIndex) const
  {
    UInt32 streamIndex = 0;
    for (UInt32 i = 0; i < coderIndex; i++)
      streamIndex += Coders[i].NumOutStreams;
    return streamIndex;
  }


  void FindInStream(UInt32 streamIndex, UInt32 &coderIndex, 
      UInt32 &coderStreamIndex) const
  {
    for (coderIndex = 0; coderIndex < (UInt32)Coders.Size(); coderIndex++)
    {
      UInt32 curSize = Coders[coderIndex].NumInStreams;
      if (streamIndex < curSize)
      {
        coderStreamIndex = streamIndex;
        return;
      }
      streamIndex -= curSize;
    }
    throw 1;
  }
  void FindOutStream(UInt32 streamIndex, UInt32 &coderIndex, 
      UInt32 &coderStreamIndex) const
  {
    for (coderIndex = 0; coderIndex < (UInt32)Coders.Size(); coderIndex++)
    {
      UInt32 curSize = Coders[coderIndex].NumOutStreams;
      if (streamIndex < curSize)
      {
        coderStreamIndex = streamIndex;
        return;
      }
      streamIndex -= curSize;
    }
    throw 1;
  }
};

class CBindReverseConverter
{
  UInt32 _numSrcOutStreams;
  const NCoderMixer2::CBindInfo _srcBindInfo;
  CRecordVector<UInt32> _srcInToDestOutMap;
  CRecordVector<UInt32> _srcOutToDestInMap;
  CRecordVector<UInt32> _destInToSrcOutMap;
public:
  UInt32 NumSrcInStreams;
  CRecordVector<UInt32> DestOutToSrcInMap;

  CBindReverseConverter(const NCoderMixer2::CBindInfo &srcBindInfo);
  void CreateReverseBindInfo(NCoderMixer2::CBindInfo &destBindInfo);
};

struct CCoderInfo
{
  CMyComPtr<ICompressCoder> Coder;
  CMyComPtr<ICompressCoder2> Coder2;
  UInt32 NumInStreams;
  UInt32 NumOutStreams;

  CRecordVector<UInt64> InSizes;
  CRecordVector<UInt64> OutSizes;
  CRecordVector<const UInt64 *> InSizePointers;
  CRecordVector<const UInt64 *> OutSizePointers;

  CCoderInfo(UInt32 numInStreams, UInt32 numOutStreams);
  void SetCoderInfo(const UInt64 **inSizes, const UInt64 **outSizes);
};

class CCoderMixer2
{
public:
  virtual void SetBindInfo(const CBindInfo &bindInfo) = 0;
  virtual void ReInit() = 0;
  virtual void SetCoderInfo(UInt32 coderIndex, const UInt64 **inSizes, const UInt64 **outSizes) = 0;
};

}
#endif

