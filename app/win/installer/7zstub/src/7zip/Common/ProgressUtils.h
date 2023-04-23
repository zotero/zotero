// ProgressUtils.h

#ifndef __PROGRESSUTILS_H
#define __PROGRESSUTILS_H

#include "../../Common/MyCom.h"

#include "../ICoder.h"
#include "../IProgress.h"

class CLocalCompressProgressInfo: 
  public ICompressProgressInfo,
  public CMyUnknownImp
{
  CMyComPtr<ICompressProgressInfo> _progress;
  bool _inStartValueIsAssigned;
  bool _outStartValueIsAssigned;
  UInt64 _inStartValue;
  UInt64 _outStartValue;
public:
  void Init(ICompressProgressInfo *progress, 
      const UInt64 *inStartValue, const UInt64 *outStartValue);

  MY_UNKNOWN_IMP

  STDMETHOD(SetRatioInfo)(const UInt64 *inSize, const UInt64 *outSize);
};

class CLocalProgress: 
  public ICompressProgressInfo,
  public CMyUnknownImp
{
  CMyComPtr<IProgress> _progress;
  bool _inSizeIsMain;
public:
  void Init(IProgress *progress, bool inSizeIsMain);

  MY_UNKNOWN_IMP

  STDMETHOD(SetRatioInfo)(const UInt64 *inSize, const UInt64 *outSize);
};

#endif
