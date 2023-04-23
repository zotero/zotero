// LZOutWindow.cpp

#include "StdAfx.h"

#include "../../../Common/Alloc.h"
#include "LZOutWindow.h"

void CLZOutWindow::Init(bool solid)
{
  if(!solid)
    COutBuffer::Init();
  #ifdef _NO_EXCEPTIONS
  ErrorCode = S_OK;
  #endif
}


