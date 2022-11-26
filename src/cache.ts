import { newCache } from 'transitory';

const cache = newCache()
  .maxSize(1000)
  .expireAfterRead(600000)
  .build();

export default cache;