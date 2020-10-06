'use strict';
const crypto = require('crypto');
const pug = require('pug');
const Cookies = require('cookies');
const util = require('./handler-util');
const Post = require('./post');
const trackingIdKey = 'tracking_id';
const oneTimeTokenMap = new Map(); //キーをユーザー名、値をトークンとする連想配列
const moment = require('moment-timezone');
const secretKey = `c910974154c1260a1e9ecb0d5cbec551fc34757c7f5a51835cb28a73ddf167504f597db9ce84b91f575f0d2446c113a0ded206277d65d3e1dff1908be9cf91bf161e6fb08132f462eccfafa7a91d2ae6a4441336d7c3bacf49c2aeaebb5a92106e2836b9492b706b1178c332f73df1af52fb93cb0c424eb53d0c88902b85e1f5038b6eff9d0ff97459dc36da08d4c80c35c601d3d868443f97c9ad4c7a0666ed40d5cc2cb6eafe11282ebd460dc23eef0f2fd8e321d51e79ca50f7f77ce4af572d43f3e952ddd492ceebf25a8c66a863180bc5b48a3169dee1316f7962db4d742856ad3dcabc427c1498b8c68a8dd38788c75394a0761faced50d7372b1bbe8b`;

function handle(req,res){
  const cookies = new Cookies(req, res);
  const trackingId = addTrackingCookie(cookies, req.user);

  switch(req.method){
    case 'GET':
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8'
      });
      Post.findAll({order:[['id','DESC']]}).then((posts) => {
        posts.forEach((post) => {
          post.content = post.content.replace(/\+/g, ' ');
          post.formattedCreatedAt = moment(post.createdAt).tz('Asia/Tokyo').format('YYYY年MM月DD日 HH時mm分ss秒');
        });
        const oneTimeToken = crypto.randomBytes(8).toString('hex');
        oneTimeTokenMap.set(req.user, oneTimeToken);
        res.end(pug.renderFile('./views/posts.pug', {
          posts: posts,
          user: req.user,
          oneTimeToken : oneTimeToken
        }));
        console.info(
          `閲覧されました: user: ${req.user}, ` +
          `trackingId: ${trackingId}, ` + 
          `remoteAddress: ${req.connection.remoteAddress}, ` +
          `userAgent: ${req.headers['user-agent']}`
        );
      });
      break;
    case 'POST':
      let body = '';
      req.on('data', (chunk) => {
        body = body + chunk;
      }).on('end',() => {
        const decoded = decodeURIComponent(body);
        const dataArray = decoded.split('&');
        const content = dataArray[0] ? dataArray[0].split('content=')[1] : '';
        const requestedOneTimeToken = dataArray[1] ? dataArray[1].split('oneTimeToken=')[1] : '';
        if (oneTimeTokenMap.get(req.user) === requestedOneTimeToken ){
          console.info('投稿されました: ' + content);
          Post.create({
            content: content,
            trackingCookie: trackingId,
            postedBy: req.user
        }).then(() =>{
          oneTimeTokenMap.delete(req.user);
          handleRedirectPosts(req,res);
        });
      }else{
        util.handleBadRequest(req, res);
      }
      });
      break;
    default:
      util.handleBadRequest(req, res);
      break;
  }
}

function handleDelete(req, res){
  switch(req.method){
    case 'POST':
      let body = '';
      req.on('data',(chunk) =>{
        body += chunk;
      }).on('end',() =>{
        const decoded = decodeURIComponent(body);
        const dataArray = decoded.split('&');
        const id = dataArray[0] ? dataArray[0].split('id=')[1] : '';
        const requestedOneTimeToken = dataArray[1] ? dataArray[1].split('oneTimeToken=')[1]:'';
        if (oneTimeTokenMap.get(req.user) === requestedOneTimeToken){
          Post.findByPk(id).then((post) => {
          if (req.user === post.postedBy || req.user === 'admin') {
            post.destroy().then(() => {
              console.info(
                `削除されました: user: ${req.user}, ` +
                `remoteAddress: ${req.connection.remoteAddress}, ` + 
                `userAgent: ${req.headers['user-agent']} `
              );
              oneTimeTokenMap.delete(req.user);
              handleRedirectPosts(req, res);
            });
          }  
        });
      }else{
        util.handleBadRequest(req, res);
      }  
    });
      break;
    default:
      util.handleBadRequest(req, res);
      break;
  }
}

// Cookieに含まれているトラッキングIDに異常がなければその値を返し、存在しない場合や異常なものである場合には、再度作成しCookieに付与してその値を返す
// @param {Cookies} cookies
// @param {String} userName
// @return {String} トラッキングID

function addTrackingCookie(cookies, userName) {
  const requestedTrackingId = cookies.get(trackingIdKey);
  if (isValidTrackingId(requestedTrackingId, userName)){
    return requestedTrackingId;
  }else {
    const originalId = parseInt(crypto.randomBytes(8).toString('hex'), 16);
    const tomorrow = new Date(Date.now() + (1000 *60 * 60 *24));
    const trackingId = originalId + '_' + createValidHash(originalId, userName);
    cookies.set(trackingIdKey, trackingId, {expires: tomorrow});
    return trackingId;
  }
}

function isValidTrackingId(trackingId, userName) {
  if(!trackingId){
    return false;
  }
  const splitted = trackingId.split('_');
  const originalId = splitted [0];
  const requestedHash = splitted[1];
  return createValidHash(originalId, userName) === requestedHash;
}

function createValidHash(originalId, userName) {
  const shalsum = crypto.createHash('sha1');
  shalsum.update(originalId + userName + secretKey );
  return shalsum.digest('hex');
}

function handleRedirectPosts(req, res){
  res.writeHead(303, {
    'Location': '/posts'
  });
  res.end();
}
module.exports ={
  handle,
  handleDelete
};