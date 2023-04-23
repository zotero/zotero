// ICoder.h

#ifndef __ICODER_H
#define __ICODER_H

#include "IStream.h"

// "23170F69-40C1-278A-0000-000400xx0000"
#define CODER_INTERFACE(i, x) \
DEFINE_GUID(IID_ ## i, \
0x23170F69, 0x40C1, 0x278A, 0x00, 0x00, 0x00, 0x04, 0x00, x, 0x00, 0x00); \
struct i: public IUnknown

CODER_INTERFACE(ICompressProgressInfo, 0x04)
{
  STDMETHOD(SetRatioInfo)(const UInt64 *inSize, const UInt64 *outSize) PURE;
};

CODER_INTERFACE(ICompressCoder, 0x05)
{
  STDMETHOD(Code)(ISequentialInStream *inStream,
      ISequentialOutStream *outStream, 
      const UInt64 *inSize, 
      const UInt64 *outSize,
      ICompressProgressInfo *progress) PURE;
};

CODER_INTERFACE(ICompressCoder2, 0x18)
{
  STDMETHOD(Code)(ISequentialInStream **inStreams,
      const UInt64 **inSizes, 
      UInt32 numInStreams,
      ISequentialOutStream **outStreams, 
      const UInt64 **outSizes,
      UInt32 numOutStreams,
      ICompressProgressInfo *progress) PURE;
};

namespace NCoderPropID
{
  enum EEnum
  {
    kDictionarySize = 0x400,
    kUsedMemorySize,
    kOrder,
    kPosStateBits = 0x440,
    kLitContextBits,
    kLitPosBits,
    kNumFastBytes = 0x450,
    kMatchFinder,
    kMatchFinderCycles,
    kNumPasses = 0x460, 
    kAlgorithm = 0x470,
    kMultiThread = 0x480,
    kNumThreads,
    kEndMarker = 0x490
  };
}

CODER_INTERFACE(ICompressSetCoderProperties, 0x20)
{
  STDMETHOD(SetCoderProperties)(const PROPID *propIDs, 
      const PROPVARIANT *properties, UInt32 numProperties) PURE;
};

/*
CODER_INTERFACE(ICompressSetCoderProperties, 0x21)
{
  STDMETHOD(SetDecoderProperties)(ISequentialInStream *inStream) PURE;
};
*/

CODER_INTERFACE(ICompressSetDecoderProperties2, 0x22)
{
  STDMETHOD(SetDecoderProperties2)(const Byte *data, UInt32 size) PURE;
};

CODER_INTERFACE(ICompressWriteCoderProperties, 0x23)
{
  STDMETHOD(WriteCoderProperties)(ISequentialOutStream *outStreams) PURE;
};

CODER_INTERFACE(ICompressGetInStreamProcessedSize, 0x24)
{
  STDMETHOD(GetInStreamProcessedSize)(UInt64 *value) PURE;
};

CODER_INTERFACE(ICompressSetCoderMt, 0x25)
{
  STDMETHOD(SetNumberOfThreads)(UInt32 numThreads) PURE;
};

CODER_INTERFACE(ICompressGetSubStreamSize, 0x30)
{
  STDMETHOD(GetSubStreamSize)(UInt64 subStream, UInt64 *value) PURE;
};

CODER_INTERFACE(ICompressSetInStream, 0x31)
{
  STDMETHOD(SetInStream)(ISequentialInStream *inStream) PURE;
  STDMETHOD(ReleaseInStream)() PURE;
};

CODER_INTERFACE(ICompressSetOutStream, 0x32)
{
  STDMETHOD(SetOutStream)(ISequentialOutStream *outStream) PURE;
  STDMETHOD(ReleaseOutStream)() PURE;
};

CODER_INTERFACE(ICompressSetInStreamSize, 0x33)
{
  STDMETHOD(SetInStreamSize)(const UInt64 *inSize) PURE;
};

CODER_INTERFACE(ICompressSetOutStreamSize, 0x34)
{
  STDMETHOD(SetOutStreamSize)(const UInt64 *outSize) PURE;
};

CODER_INTERFACE(ICompressFilter, 0x40)
{
  STDMETHOD(Init)() PURE;
  STDMETHOD_(UInt32, Filter)(Byte *data, UInt32 size) PURE;
  // Filter return outSize (UInt32)
  // if (outSize <= size): Filter have converted outSize bytes
  // if (outSize > size): Filter have not converted anything.
  //      and it needs at least outSize bytes to convert one block 
  //      (it's for crypto block algorithms).
};

CODER_INTERFACE(ICryptoProperties, 0x80)
{
  STDMETHOD(SetKey)(const Byte *data, UInt32 size) PURE;
  STDMETHOD(SetInitVector)(const Byte *data, UInt32 size) PURE;
};

CODER_INTERFACE(ICryptoSetPassword, 0x90)
{
  STDMETHOD(CryptoSetPassword)(const Byte *data, UInt32 size) PURE;
};

CODER_INTERFACE(ICryptoSetCRC, 0xA0)
{
  STDMETHOD(CryptoSetCRC)(UInt32 crc) PURE;
};

//////////////////////
// It's for DLL file
namespace NMethodPropID
{
  enum EEnum
  {
    kID,
    kName,
    kDecoder,
    kEncoder,
    kInStreams,
    kOutStreams,
    kDescription
  };
}

#endif
