// OpenCallbackGUI.cpp

#include "StdAfx.h"

#include "OpenCallbackGUI.h"

#include "Common/StdOutStream.h"
#include "Common/StdInStream.h"
#include "Common/StringConvert.h"

#ifndef _NO_CRYPTO
#include "../../FileManager/Resource/PasswordDialog/PasswordDialog.h"
#endif

HRESULT COpenCallbackGUI::CheckBreak()
{
  return S_OK;
}

HRESULT COpenCallbackGUI::SetTotal(const UInt64 *files, const UInt64 *bytes)
{
  return S_OK;
}

HRESULT COpenCallbackGUI::SetCompleted(const UInt64 *files, const UInt64 *bytes)
{
  return S_OK;
}
 
#ifndef _NO_CRYPTO
HRESULT COpenCallbackGUI::CryptoGetTextPassword(BSTR *password)
{
  if (!PasswordIsDefined)
  {
    CPasswordDialog dialog;
    if (dialog.Create(ParentWindow) == IDCANCEL)
      return E_ABORT;
    Password = dialog.Password;
    PasswordIsDefined = true;
  }
  CMyComBSTR tempName(Password);
  *password = tempName.Detach();
  return S_OK;
}

HRESULT COpenCallbackGUI::GetPasswordIfAny(UString &password)
{
  if (PasswordIsDefined)
    password = Password;
  return S_OK;
}
#endif  

