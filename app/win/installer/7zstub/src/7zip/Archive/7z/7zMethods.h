// 7zMethods.h

#ifndef __7Z_METHODS_H
#define __7Z_METHODS_H

#include "7zMethodID.h"

namespace NArchive {
namespace N7z {

struct CMethodInfo
{
  UString Name;
  bool EncoderIsAssigned;
  bool DecoderIsAssigned;
  UInt32 NumInStreams;
  UInt32 NumOutStreams;
  CLSID Encoder;
  CLSID Decoder;
  // UString Description;
  CSysString FilePath;
};

struct CMethodInfo2: public CMethodInfo
{
  CMethodID MethodID;
};

void LoadMethodMap();
bool GetMethodInfo(const CMethodID &methodID, CMethodInfo &methodInfo);
bool GetMethodInfo(const UString &name, CMethodInfo2 &methodInfo);

}}

#endif

