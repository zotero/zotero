/* BranchX86.h */

#ifndef __BRANCHX86_H
#define __BRANCHX86_H

#include "BranchTypes.h"

#define x86_Convert_Init(prevMask, prevPos) { prevMask = 0; prevPos = (UInt32)(-5); }

UInt32 x86_Convert(Byte *buffer, UInt32 endPos, UInt32 nowPos, 
    UInt32 *prevMask, UInt32 *prevPos, int encoding);

#endif
