// ComTry.h

#ifndef __COM_TRY_H
#define __COM_TRY_H

#include "MyWindows.h"
// #include "Exception.h"
// #include "NewHandler.h"

#define COM_TRY_BEGIN try {
#define COM_TRY_END } catch(...) { return E_OUTOFMEMORY; }
  
  // catch(const CNewException &) { return E_OUTOFMEMORY; }\
  // catch(const CSystemException &e) { return e.ErrorCode; }\
  // catch(...) { return E_FAIL; }

#endif
