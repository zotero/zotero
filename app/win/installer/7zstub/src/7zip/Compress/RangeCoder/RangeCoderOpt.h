// Compress/RangeCoder/RangeCoderOpt.h

#ifndef __COMPRESS_RANGECODER_OPT_H
#define __COMPRESS_RANGECODER_OPT_H

#define RC_INIT_VAR \
  UInt32 range = rangeDecoder->Range; \
  UInt32 code = rangeDecoder->Code;        

#define RC_FLUSH_VAR \
  rangeDecoder->Range = range; \
  rangeDecoder->Code = code;

#define RC_NORMALIZE \
  if (range < NCompress::NRangeCoder::kTopValue) \
    { code = (code << 8) | rangeDecoder->Stream.ReadByte(); range <<= 8; }

#define RC_GETBIT2(numMoveBits, prob, mi, A0, A1) \
  { UInt32 bound = (range >> NCompress::NRangeCoder::kNumBitModelTotalBits) * prob; \
  if (code < bound) \
  { A0; range = bound; \
    prob += (NCompress::NRangeCoder::kBitModelTotal - prob) >> numMoveBits; \
    mi <<= 1; } \
  else \
  { A1; range -= bound; code -= bound; prob -= (prob) >> numMoveBits; \
    mi = (mi + mi) + 1; }} \
  RC_NORMALIZE

#define RC_GETBIT(numMoveBits, prob, mi) RC_GETBIT2(numMoveBits, prob, mi, ; , ;)

#endif
