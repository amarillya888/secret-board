'use strict';
const pug = require('pug');
const assert = require('assert');

const html = pug.renderFile('./views/posts.pug', {
  posts: [{
    id: 1,
    content:'<script>alert(\'test\');</script>',
    postedBy: 'guest1',
    trackingCookie: '4391976947991005_0d6aeb0d6ad6bc82d29857339d6f304b3054dd5b',
    createdAt: new Date(),
    updatedAt: new Date()
  }],
  user: 'guest1'
});

// console.log(html);
assert(html.includes('&lt;script&gt;alert(\'test\');&lt;/script&gt;'));
console.log('テストが正常に完了しました');