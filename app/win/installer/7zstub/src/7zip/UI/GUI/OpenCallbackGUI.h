// OpenCallbackGUI.h

#ifndef __OPEN_CALLBACK_GUI_H
#define __OPEN_CALLBACK_GUI_H

#include "../Common/ArchiveOpenCallback.h"

class COpenCallbackGUI: public IOpenCallbackUI
{
public:
  HRESULT CheckBreak();
  HRESULT SetTotal(const UInt64 *files, const UInt64 *bytes);
  HRESULT SetCompleted(const UInt64 *files, const UInt64 *bytes);
  #ifndef _NO_CRYPTO
  HRESULT CryptoGetTextPassword(BSTR *password);
  HRESULT GetPasswordIfAny(UString &password);
  bool PasswordIsDefined;
  UString Password;
  #endif  
  
  HWND ParentWindow;

  COpenCallbackGUI(): 
    #ifndef _NO_CRYPTO
    PasswordIsDefined(false), 
    #endif  
    ParentWindow(0) {}
};

#endif
