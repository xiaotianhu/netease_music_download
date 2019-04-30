const puppeteer = require('puppeteer');
const fs = require('fs');
resultFile = "/tmp/netease"
browser = null;
baseUrl = "https://music.163.com/#/album?id=";
albumId = 0;
song = [];
songs = [];

//打开新页面
async function openNewPage(url){
  var page = await browser.newPage();
  await page.goto(url, {waitUntil:"domcontentloaded",timeout:0});
  return page;
}
//抓取入口
async function init(){
  albumId = getCliParams();
  browser = await puppeteer.launch();
  //browser = await puppeteer.launch({headless:false});
  await getListPage();

  //拿到全部列表,开始下载
  console.log(songs);
  var writeJson = JSON.stringify(songs);
  fs.writeFileSync(resultFile, writeJson);
  await browser.close();
}

async function getListPage(){
    var url = baseUrl + albumId;
    await openNewPage(url).then(async page=>{
        page.on('response', intercepter);
        page.on('console', consoleMsg);
        await page.evaluate(injectListpage);
    })
    .catch(function(e){
        console.log(e);
    })
}
//拦截请求 https://pptr.dev/#?product=Puppeteer&version=v1.14.0&show=api-class-response
async function intercepter(resp){
    var url = resp.url();
    if(url.indexOf("/weapi/song/enhance/player/url/v1")<0) return;

    await resp.json().then(jsonres =>{
        //console.log(jsonres);
        if(typeof(song[1] == 'undefined')){
            song[1] = jsonres.data[0].url;
            //song[2] = jsonres.data[0].id;
            songs.push(song);
        }
        song = [];
    }).catch(e=>{
        console.log('err json');
    })
}
//拦截console请求 为了与页内通信
function consoleMsg(msg){
    console.log(msg.text());
    if(msg.text().indexOf("songmenu:")>=0){
        song[0] = msg.text().replace("songmenu:","");
        console.log("get one song:..."+song[0]);
    }
    if(msg.text().indexOf("songid:")>=0){
        song[2] = msg.text().replace("songid:","");
        console.log("get one song id:..."+song[2]);
    }

}
//注入到列表页内的方法
//遍历列表 & 点击 &拿到下载地址
async function injectListpage(){
    var iframeDocument = window.parent.document.getElementById("g_iframe").contentWindow.document;
    var trs = iframeDocument.querySelectorAll(".m-table > tbody > tr");
    for(tr in trs){
        if(trs[tr] == null || trs[tr] == undefined) continue;
        if(typeof(trs[tr].querySelector) != 'function') continue;
        var onesong = trs[tr].querySelector(".left>div>.ply");
        var title = trs[tr].querySelector("b").getAttribute("title");
        var songid = trs[tr].querySelector("a").getAttribute("href");
        console.log("songmenu:"+title);
        console.log("songid:"+songid);

        await new Promise((resolve)=>{
            setTimeout(()=>{
                onesong.click();
                resolve();
            }, 1000);//默认等待1s在下载下一首
        })
    }
    return;
}

//从命令行获取参数
function getCliParams() {
    var options = process.argv;
    if(typeof(options[2]) == 'undefined'){
        console.log("usage: node netease.js 112233(albumid)");
        process.exit();
    }
    if(typeof(options[3]) != 'undefined' && options[3].length>1){
        resultFile = options[3];        
    }
    return options[2];
}

init();
