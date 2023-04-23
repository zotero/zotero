// LockedStream.h

#ifndef __LOCKEDSTREAM_H
#define __LOCKEDSTREAM_H

#include "../../Windows/Synchronization.h"
#include "../../Common/MyCom.h"
#include "../IStream.h"

class CLockedInStream
{
  CMyComPtr<IInStream> _stream;
  NWindows::NSynchronization::CCriticalSection _criticalSection;
public:
  void Init(IInStream *stream)
    { _stream = stream; }
  HRESULT Read(UInt64 startPos, void *data, UInt32 size, UInt32 *processedSize);
};

class CLockedSequentialInStreamImp: 
  public ISequentialInStream,
  public CMyUnknownImp
{
  CLockedInStream *_lockedInStream;
  UInt64 _pos;
public:
  void Init(CLockedInStream *lockedInStream, UInt64 startPos)
  {
    _lockedInStream = lockedInStream;
    _pos = startPos;
  }

  MY_UNKNOWN_IMP

  STDMETHOD(Read)(void *data, UInt32 size, UInt32 *processedSize);
};

#endif
