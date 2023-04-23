/* BranchTypes.h */

#ifndef __BRANCHTYPES_H
#define __BRANCHTYPES_H

typedef unsigned char Byte;
typedef unsigned short UInt16;

#ifdef _LZMA_UINT32_IS_ULONG
typedef unsigned long UInt32;
#else
typedef unsigned int UInt32;
#endif

#endif
