// CoderMixer2MT.h

#ifndef __CODER_MIXER2_MT_H
#define __CODER_MIXER2_MT_H

#include "CoderMixer2.h"
#include "../../../Common/MyCom.h"
#include "../../../Windows/Thread.h"
#include "../../Common/StreamBinder.h"

namespace NCoderMixer2 {

//  CreateEvents();
//  {
//    SetCoderInfo()
//    Init Streams   
//    set CompressEvent()
//    wait CompressionCompletedEvent
//  }

struct CThreadCoderInfo: public CCoderInfo
{
  NWindows::NSynchronization::CAutoResetEvent *CompressEvent;
  HANDLE ExitEvent;
  NWindows::NSynchronization::CAutoResetEvent *CompressionCompletedEvent;

  CObjectVector< CMyComPtr<ISequentialInStream> > InStreams;
  CObjectVector< CMyComPtr<ISequentialOutStream> > OutStreams;
  CRecordVector<ISequentialInStream *> InStreamPointers;
  CRecordVector<ISequentialOutStream *> OutStreamPointers;

  CMyComPtr<ICompressProgressInfo> Progress; // CMyComPtr
  HRESULT Result;

  CThreadCoderInfo(UInt32 numInStreams, UInt32 numOutStreams);
  void SetCoderInfo(const UInt64 **inSizes,
      const UInt64 **outSizes, ICompressProgressInfo *progress);
  ~CThreadCoderInfo();
  bool WaitAndCode();
  void CreateEvents();
};


//  SetBindInfo()
//  for each coder
//  {
//    AddCoder[2]()
//  }
// 
//  for each file
//  {
//    ReInit()
//    for each coder
//    {
//      SetCoderInfo  
//    }
//    SetProgressIndex(UInt32 coderIndex);
//    Code
//  }


class CCoderMixer2MT:
  public ICompressCoder2,
  public CCoderMixer2,
  public CMyUnknownImp
{
  MY_UNKNOWN_IMP

public:
  STDMETHOD(Init)(ISequentialInStream **inStreams,
    ISequentialOutStream **outStreams);

  STDMETHOD(Code)(ISequentialInStream **inStreams,
      const UInt64 **inSizes, 
      UInt32 numInStreams,
      ISequentialOutStream **outStreams, 
      const UInt64 **outSizes,
      UInt32 numOutStreams,
      ICompressProgressInfo *progress);


  CCoderMixer2MT();
  ~CCoderMixer2MT();
  void AddCoderCommon();
  void AddCoder(ICompressCoder *coder);
  void AddCoder2(ICompressCoder2 *coder);

  void ReInit();
  void SetCoderInfo(UInt32 coderIndex, const UInt64 **inSizes, const UInt64 **outSizes)
    {  _coderInfoVector[coderIndex].SetCoderInfo(inSizes, outSizes, NULL); }
  void SetProgressCoderIndex(UInt32 coderIndex)
    {  _progressCoderIndex = coderIndex; }


  UInt64 GetWriteProcessedSize(UInt32 binderIndex) const;


  bool MyCode();

private:
  CBindInfo _bindInfo;
  CObjectVector<CStreamBinder> _streamBinders;
  CObjectVector<CThreadCoderInfo> _coderInfoVector;
  CRecordVector<NWindows::CThread> _threads;
  NWindows::CThread _mainThread;

  NWindows::NSynchronization::CAutoResetEvent _startCompressingEvent;
  CRecordVector<HANDLE> _compressingCompletedEvents;
  NWindows::NSynchronization::CAutoResetEvent _compressingFinishedEvent;

  NWindows::NSynchronization::CManualResetEvent _exitEvent;
  UInt32 _progressCoderIndex;

public:
  void SetBindInfo(const CBindInfo &bindInfo);

};

}
#endif

