// CoderMixer2MT.cpp

#include "StdAfx.h"

#include "CoderMixer2MT.h"
#include "CrossThreadProgress.h"

using namespace NWindows;
using namespace NSynchronization;

namespace NCoderMixer2 {

CThreadCoderInfo::CThreadCoderInfo(UInt32 numInStreams, UInt32 numOutStreams): 
    ExitEvent(NULL), 
    CompressEvent(NULL), 
    CompressionCompletedEvent(NULL), 
    CCoderInfo(numInStreams, numOutStreams)
{
  InStreams.Reserve(NumInStreams);
  InStreamPointers.Reserve(NumInStreams);
  OutStreams.Reserve(NumOutStreams);
  OutStreamPointers.Reserve(NumOutStreams);
}

void CThreadCoderInfo::CreateEvents()
{
  CompressEvent = new CAutoResetEvent(false);
  CompressionCompletedEvent = new CAutoResetEvent(false);
}

CThreadCoderInfo::~CThreadCoderInfo()
{
  if (CompressEvent != NULL)
    delete CompressEvent;
  if (CompressionCompletedEvent != NULL)
    delete CompressionCompletedEvent;
}

class CCoderInfoFlusher2
{
  CThreadCoderInfo *m_CoderInfo;
public:
  CCoderInfoFlusher2(CThreadCoderInfo *coderInfo): m_CoderInfo(coderInfo) {}
  ~CCoderInfoFlusher2()
  {
	  int i;
    for (i = 0; i < m_CoderInfo->InStreams.Size(); i++)
      m_CoderInfo->InStreams[i].Release();
    for (i = 0; i < m_CoderInfo->OutStreams.Size(); i++)
      m_CoderInfo->OutStreams[i].Release();
    m_CoderInfo->CompressionCompletedEvent->Set();
  }
};

bool CThreadCoderInfo::WaitAndCode()
{
  HANDLE events[2] = { ExitEvent, *CompressEvent };
  DWORD waitResult = ::WaitForMultipleObjects(2, events, FALSE, INFINITE);
  if (waitResult == WAIT_OBJECT_0 + 0)
    return false;

  {
    InStreamPointers.Clear();
    OutStreamPointers.Clear();
    UInt32 i;
    for (i = 0; i < NumInStreams; i++)
    {
      if (InSizePointers[i] != NULL)
        InSizePointers[i] = &InSizes[i];
      InStreamPointers.Add(InStreams[i]);
    }
    for (i = 0; i < NumOutStreams; i++)
    {
      if (OutSizePointers[i] != NULL)
        OutSizePointers[i] = &OutSizes[i];
      OutStreamPointers.Add(OutStreams[i]);
    }
    CCoderInfoFlusher2 coderInfoFlusher(this);
    if (Coder)
      Result = Coder->Code(InStreamPointers[0],
        OutStreamPointers[0],
        InSizePointers[0],
        OutSizePointers[0],
        Progress);
    else
      Result = Coder2->Code(&InStreamPointers.Front(),
        &InSizePointers.Front(),
        NumInStreams,
        &OutStreamPointers.Front(),
        &OutSizePointers.Front(),
        NumOutStreams,
        Progress);
  }
  return true;
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


void CThreadCoderInfo::SetCoderInfo(const UInt64 **inSizes,
      const UInt64 **outSizes, ICompressProgressInfo *progress)
{
  Progress = progress;
  SetSizes(inSizes, InSizes, InSizePointers, NumInStreams);
  SetSizes(outSizes, OutSizes, OutSizePointers, NumOutStreams);
}

static DWORD WINAPI CoderThread(void *threadCoderInfo)
{
  while(true)
  {
    if (!((CThreadCoderInfo *)threadCoderInfo)->WaitAndCode())
      return 0;
  }
}

//////////////////////////////////////
// CCoderMixer2MT

static DWORD WINAPI MainCoderThread(void *threadCoderInfo)
{
  while(true)
  {
    if (!((CCoderMixer2MT *)threadCoderInfo)->MyCode())
      return 0;
  }
}

CCoderMixer2MT::CCoderMixer2MT()
{
  if (!_mainThread.Create(MainCoderThread, this))
    throw 271825;
}

CCoderMixer2MT::~CCoderMixer2MT()
{
  _exitEvent.Set();
  _mainThread.Wait();
  for(int i = 0; i < _threads.Size(); i++)
  {
    _threads[i].Wait();
    _threads[i].Close();
  }
}

void CCoderMixer2MT::SetBindInfo(const CBindInfo &bindInfo)
{  
  _bindInfo = bindInfo; 
  _streamBinders.Clear();
  for(int i = 0; i < _bindInfo.BindPairs.Size(); i++)
  {
    _streamBinders.Add(CStreamBinder());
    _streamBinders.Back().CreateEvents();
  }
}

void CCoderMixer2MT::AddCoderCommon()
{
  int index = _coderInfoVector.Size();
  const CCoderStreamsInfo &CoderStreamsInfo = _bindInfo.Coders[index];

  CThreadCoderInfo threadCoderInfo(CoderStreamsInfo.NumInStreams, 
      CoderStreamsInfo.NumOutStreams);
  _coderInfoVector.Add(threadCoderInfo);
  _coderInfoVector.Back().CreateEvents();
  _coderInfoVector.Back().ExitEvent = _exitEvent;
  _compressingCompletedEvents.Add(*_coderInfoVector.Back().CompressionCompletedEvent);

  NWindows::CThread newThread;
  _threads.Add(newThread);
  if (!_threads.Back().Create(CoderThread, &_coderInfoVector.Back()))
    throw 271824;
}

void CCoderMixer2MT::AddCoder(ICompressCoder *coder)
{
  AddCoderCommon();
  _coderInfoVector.Back().Coder = coder;
}

void CCoderMixer2MT::AddCoder2(ICompressCoder2 *coder)
{
  AddCoderCommon();
  _coderInfoVector.Back().Coder2 = coder;
}

/*
void CCoderMixer2MT::FinishAddingCoders()
{
  for(int i = 0; i < _coderInfoVector.Size(); i++)
  {
    DWORD id;
    HANDLE newThread = ::CreateThread(NULL, 0, CoderThread, 
        &_coderInfoVector[i], 0, &id);
    if (newThread == 0)
      throw 271824;
    _threads.Add(newThread);
  }
}
*/

void CCoderMixer2MT::ReInit()
{
  for(int i = 0; i < _streamBinders.Size(); i++)
    _streamBinders[i].ReInit();
}


STDMETHODIMP CCoderMixer2MT::Init(ISequentialInStream **inStreams,
    ISequentialOutStream **outStreams) 
{
  if (_coderInfoVector.Size() != _bindInfo.Coders.Size())
    throw 0;
  int i;
  for(i = 0; i < _coderInfoVector.Size(); i++)
  {
    CThreadCoderInfo &coderInfo = _coderInfoVector[i];
    const CCoderStreamsInfo &coderStreamsInfo = _bindInfo.Coders[i];
    coderInfo.InStreams.Clear();
    UInt32 j;
    for(j = 0; j < coderStreamsInfo.NumInStreams; j++)
      coderInfo.InStreams.Add(NULL);
    coderInfo.OutStreams.Clear();
    for(j = 0; j < coderStreamsInfo.NumOutStreams; j++)
      coderInfo.OutStreams.Add(NULL);
  }

  for(i = 0; i < _bindInfo.BindPairs.Size(); i++)
  {
    const CBindPair &bindPair = _bindInfo.BindPairs[i];
    UInt32 inCoderIndex, inCoderStreamIndex;
    UInt32 outCoderIndex, outCoderStreamIndex;
    _bindInfo.FindInStream(bindPair.InIndex, inCoderIndex, inCoderStreamIndex);
    _bindInfo.FindOutStream(bindPair.OutIndex, outCoderIndex, outCoderStreamIndex);

    _streamBinders[i].CreateStreams(
        &_coderInfoVector[inCoderIndex].InStreams[inCoderStreamIndex],
        &_coderInfoVector[outCoderIndex].OutStreams[outCoderStreamIndex]);
  }

  for(i = 0; i < _bindInfo.InStreams.Size(); i++)
  {
    UInt32 inCoderIndex, inCoderStreamIndex;
    _bindInfo.FindInStream(_bindInfo.InStreams[i], inCoderIndex, inCoderStreamIndex);
    _coderInfoVector[inCoderIndex].InStreams[inCoderStreamIndex] = inStreams[i];
  }
  
  for(i = 0; i < _bindInfo.OutStreams.Size(); i++)
  {
    UInt32 outCoderIndex, outCoderStreamIndex;
    _bindInfo.FindOutStream(_bindInfo.OutStreams[i], outCoderIndex, outCoderStreamIndex);
    _coderInfoVector[outCoderIndex].OutStreams[outCoderStreamIndex] = outStreams[i];
  }
  return S_OK;
}


bool CCoderMixer2MT::MyCode()
{
  HANDLE events[2] = { _exitEvent, _startCompressingEvent };
  DWORD waitResult = ::WaitForMultipleObjects(2, events, FALSE, INFINITE);
  if (waitResult == WAIT_OBJECT_0 + 0)
    return false;

  for(int i = 0; i < _coderInfoVector.Size(); i++)
    _coderInfoVector[i].CompressEvent->Set();
  DWORD result = ::WaitForMultipleObjects(_compressingCompletedEvents.Size(), 
      &_compressingCompletedEvents.Front(), TRUE, INFINITE);
  
  _compressingFinishedEvent.Set();

  return true;
}


STDMETHODIMP CCoderMixer2MT::Code(ISequentialInStream **inStreams,
      const UInt64 **inSizes, 
      UInt32 numInStreams,
      ISequentialOutStream **outStreams, 
      const UInt64 **outSizes,
      UInt32 numOutStreams,
      ICompressProgressInfo *progress)
{
  if (numInStreams != (UInt32)_bindInfo.InStreams.Size() ||
      numOutStreams != (UInt32)_bindInfo.OutStreams.Size())
    return E_INVALIDARG;

  Init(inStreams, outStreams);

  _compressingFinishedEvent.Reset(); // ?
  
  CCrossThreadProgress *progressSpec = new CCrossThreadProgress;
  CMyComPtr<ICompressProgressInfo> crossProgress = progressSpec;
  progressSpec->Init();
  _coderInfoVector[_progressCoderIndex].Progress = crossProgress;

  _startCompressingEvent.Set();


  while (true)
  {
    HANDLE events[2] = {_compressingFinishedEvent, progressSpec->ProgressEvent };
    DWORD waitResult = ::WaitForMultipleObjects(2, events, FALSE, INFINITE);
    if (waitResult == WAIT_OBJECT_0 + 0)
      break;
    if (progress != NULL)
      progressSpec->Result = progress->SetRatioInfo(progressSpec->InSize, 
          progressSpec->OutSize);
    else
      progressSpec->Result = S_OK;
    progressSpec->WaitEvent.Set();
  }

  int i;
  for(i = 0; i < _coderInfoVector.Size(); i++)
  {
    HRESULT result = _coderInfoVector[i].Result;
    if (result == S_FALSE)
      return result;
  }
  for(i = 0; i < _coderInfoVector.Size(); i++)
  {
    HRESULT result = _coderInfoVector[i].Result;
    if (result != S_OK && result != E_FAIL)
      return result;
  }
  for(i = 0; i < _coderInfoVector.Size(); i++)
  {
    HRESULT result = _coderInfoVector[i].Result;
    if (result != S_OK)
      return result;
  }
  return S_OK;
}

UInt64 CCoderMixer2MT::GetWriteProcessedSize(UInt32 binderIndex) const
{
  return _streamBinders[binderIndex].ProcessedSize;
}

}  
