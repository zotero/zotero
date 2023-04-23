// IPassword.h

#ifndef __IPASSWORD_H
#define __IPASSWORD_H

#include "../Common/MyUnknown.h"
#include "../Common/Types.h"

// MIDL_INTERFACE("23170F69-40C1-278A-0000-000500xx0000")
#define PASSWORD_INTERFACE(i, x) \
DEFINE_GUID(IID_ ## i, \
0x23170F69, 0x40C1, 0x278A, 0x00, 0x00, 0x00, 0x05, 0x00, x, 0x00, 0x00); \
struct i: public IUnknown

PASSWORD_INTERFACE(ICryptoGetTextPassword, 0x10)
{
  STDMETHOD(CryptoGetTextPassword)(BSTR *password) PURE;
};

PASSWORD_INTERFACE(ICryptoGetTextPassword2, 0x11)
{
  STDMETHOD(CryptoGetTextPassword2)(Int32 *passwordIsDefined, BSTR *password) PURE;
};

#endif

