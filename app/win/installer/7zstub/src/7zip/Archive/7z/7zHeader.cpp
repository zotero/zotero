// 7z/Header.cpp

#include "StdAfx.h"
#include "7zHeader.h"

namespace NArchive {
namespace N7z {

Byte kSignature[kSignatureSize] = {'7' + 1, 'z', 0xBC, 0xAF, 0x27, 0x1C};
Byte kFinishSignature[kSignatureSize] = {'7' + 1, 'z', 0xBC, 0xAF, 0x27, 0x1C + 1};

class SignatureInitializer
{
public:
  SignatureInitializer() { kSignature[0]--; kFinishSignature[0]--;};
} g_SignatureInitializer;

}}

