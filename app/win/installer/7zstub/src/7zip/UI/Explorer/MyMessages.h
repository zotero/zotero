// MyMessages.h

#ifndef __MYMESSAGES_H
#define __MYMESSAGES_H

#include "Common/String.h"

void MyMessageBox(HWND window, LPCWSTR message);

inline void MyMessageBox(LPCWSTR message)
  {  MyMessageBox(0, message); }

void MyMessageBox(UINT32 id
    #ifdef LANG        
    ,UINT32 langID
    #endif
    );

void ShowErrorMessage(HWND window, DWORD errorMessage);
inline void ShowErrorMessage(DWORD errorMessage)
  { ShowErrorMessage(0, errorMessage); }
void ShowLastErrorMessage(HWND window = 0);

#endif
