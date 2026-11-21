/*
 * LZ4 library (BSD 2-Clause, Copyright (c) Yann Collet) compiled to WebAssembly.
 */
#include "lz4.h"
#include "lz4hc.h"

void *memset(void *d, int c, __SIZE_TYPE__ n) { return __builtin_memset(d, c, n); }
void *memcpy(void *d, const void *s, __SIZE_TYPE__ n) { return __builtin_memcpy(d, s, n); }
void *memmove(void *d, const void *s, __SIZE_TYPE__ n) { return __builtin_memmove(d, s, n); }

#define MAX_INPUT 65536

static char src_buf[MAX_INPUT];
static char dst_buf[LZ4_COMPRESSBOUND(MAX_INPUT)];
static LZ4_streamHC_t state;

char *salty_src(void) { return src_buf; }
char *salty_dst(void) { return dst_buf; }
int salty_max_input(void) { return MAX_INPUT; }
int salty_max_output(void) { return (int)sizeof(dst_buf); }

int salty_compress_hc(int size, int level) {
    return LZ4_compress_HC_extStateHC(&state, src_buf, dst_buf, size, (int)sizeof(dst_buf), level);
}

int salty_decompress(int size, int out_size) {
    return LZ4_decompress_safe(src_buf, dst_buf, size, out_size);
}
