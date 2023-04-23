// BranchCoder.h

#ifndef __BRANCH_CODER_H
#define __BRANCH_CODER_H

#include "Common/MyCom.h"
#include "Common/Types.h"
#include "Common/Alloc.h"

#include "../../ICoder.h"

class CBranchConverter:
  public ICompressFilter,
  public CMyUnknownImp
{
protected:
  UInt32 _bufferPos;
  virtual void SubInit() {}
  virtual UInt32 SubFilter(Byte *data, UInt32 size) = 0;
public:
  MY_UNKNOWN_IMP;
  STDMETHOD(Init)();
  STDMETHOD_(UInt32, Filter)(Byte *data, UInt32 size);
};

#define MyClassEncoderA(Name) class C ## Name: public CBranchConverter \
  { public: UInt32 SubFilter(Byte *data, UInt32 size); }; 

#define MyClassDecoderA(Name) class C ## Name: public CBranchConverter \
  { public: UInt32 SubFilter(Byte *data, UInt32 size); }; 

#define MyClassEncoderB(Name, ADD_ITEMS, ADD_INIT) class C ## Name: public CBranchConverter, public ADD_ITEMS \
  { public: UInt32 SubFilter(Byte *data, UInt32 size); ADD_INIT}; 

#define MyClassDecoderB(Name, ADD_ITEMS, ADD_INIT) class C ## Name: public CBranchConverter, public ADD_ITEMS \
  { public: UInt32 SubFilter(Byte *data, UInt32 size); ADD_INIT}; 

#define MyClass2b(Name, id, subId, encodingId)  \
DEFINE_GUID(CLSID_CCompressConvert ## Name,  \
0x23170F69, 0x40C1, 0x278B, 0x03, 0x03, id, subId, 0x00, 0x00, encodingId, 0x00); 

#define MyClassA(Name, id, subId)  \
MyClass2b(Name ## _Encoder, id, subId, 0x01) \
MyClassEncoderA(Name ## _Encoder) \
MyClass2b(Name ## _Decoder, id, subId, 0x00) \
MyClassDecoderA(Name ## _Decoder)

#define MyClassB(Name, id, subId, ADD_ITEMS, ADD_INIT)  \
MyClass2b(Name ## _Encoder, id, subId, 0x01) \
MyClassEncoderB(Name ## _Encoder, ADD_ITEMS, ADD_INIT) \
MyClass2b(Name ## _Decoder, id, subId, 0x00) \
MyClassDecoderB(Name ## _Decoder, ADD_ITEMS, ADD_INIT)

#endif
