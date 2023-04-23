// 7zDecode.h

#ifndef __7Z_DECODE_H
#define __7Z_DECODE_H

#include "../../IStream.h"
#include "../../IPassword.h"

#include "../Common/CoderMixer2.h"
#include "../Common/CoderMixer2MT.h"
#ifdef _ST_MODE
#include "../Common/CoderMixer2ST.h"
#endif
#ifndef EXCLUDE_COM
#include "../Common/CoderLoader.h"
#endif

#include "7zItem.h"

namespace NArchive {
namespace N7z {

struct CBindInfoEx: public NCoderMixer2::CBindInfo
{
  CRecordVector<CMethodID> CoderMethodIDs;
  void Clear()
  {
    CBindInfo::Clear();
    CoderMethodIDs.Clear();
  }
};

class CDecoder
{
  #ifndef EXCLUDE_COM
  CCoderLibraries _libraries;
  #endif

  bool _bindInfoExPrevIsDefinded;
  CBindInfoEx _bindInfoExPrev;
  
  bool _multiThread;
  #ifdef _ST_MODE
  NCoderMixer2::CCoderMixer2ST *_mixerCoderSTSpec;
  #endif
  NCoderMixer2::CCoderMixer2MT *_mixerCoderMTSpec;
  NCoderMixer2::CCoderMixer2 *_mixerCoderCommon;
  
  CMyComPtr<ICompressCoder2> _mixerCoder;
  CObjectVector<CMyComPtr<IUnknown> > _decoders;
  // CObjectVector<CMyComPtr<ICompressCoder2> > _decoders2;
public:
  CDecoder(bool multiThread);
  HRESULT Decode(IInStream *inStream,
      UInt64 startPos,
      const UInt64 *packSizes,
      const CFolder &folder, 
      ISequentialOutStream *outStream,
      ICompressProgressInfo *compressProgress
      #ifndef _NO_CRYPTO
      , ICryptoGetTextPassword *getTextPasswordSpec
      #endif
      #ifdef COMPRESS_MT
      , bool mtMode, UInt32 numThreads
      #endif
      );
};

}}

#endif
