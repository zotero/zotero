// MyMessages.cpp

#include "StdAfx.h"

#include "MyMessages.h"
#include "Common/String.h"
#include "Common/StringConvert.h"

#include "Windows/Error.h"
#include "Windows/ResourceString.h"

#ifdef LANG        
#include "../../FileManager/LangUtils.h"
#endif

using namespace NWindows;

void MyMessageBox(HWND window, LPCWSTR message)
{ 
  ::MessageBoxW(window, message, L"7-Zip", 0); 
}

void MyMessageBox(UINT32 id
    #ifdef LANG        
    ,UINT32 langID
    #endif
    )
{
  #ifdef LANG        
  MyMessageBox(LangString(id, langID));
  #else
  MyMessageBox(MyLoadStringW(id));
  #endif
}

void ShowErrorMessage(HWND window, DWORD message)
{
  MyMessageBox(window, NError::MyFormatMessageW(message));
}

void ShowLastErrorMessage(HWND window)
{
  ShowErrorMessage(window, ::GetLastError());
}

