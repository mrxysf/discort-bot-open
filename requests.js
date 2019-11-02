const ytdl = require('ytdl-core');
const youtubeConfig = require('./youtubeConfig.json');
const axios = require('axios');

async function getStream(url) {
    const stream = await ytdl(url, {
        highWaterMark: 1024 * 1024 * 10,
        quality: 'highestaudio',
        filter: 'audioonly',
    });
    return stream;
}

async function getVideoTitleByUrl(videoUrl) {
    videoId = videoUrl.split('v=')[1];
    const URL = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${youtubeConfig.key}`;

    return await axios.get(URL).then(async res => {
        return res.data.items[0].snippet.title;
    });
}

async function requestSingleSongByLink(link) {
    const music = {};
    music.url = link;
    await getStream(link).then(stream => (music.stream = stream));
    await getVideoTitleByUrl(link).then(title => (music.title = title));
    return music;
}

async function requestSingleSearch(keyword, msg) {
    const URL = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${keyword}&order=viewCount&maxResults=1&key=${youtubeConfig.key}`;
    const music = {};

    await axios
        .get(URL)
        .then(async res => {
            video = res.data.items[0];
            videoUrl = 'https://www.youtube.com/watch?v=' + video.id.videoId;
            music.url = videoUrl;
            music.title = video.snippet.title;
            await getStream(videoUrl).then(stream => {
                music.stream = stream;
            });
        })
        .catch(err => {
            console.error(err);
            msg.channel.send('There was a problem loading the link.');
        });
    return music;
}

async function requestList(playListID, msg, noMusic) {
    const URL = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${playListID}&key=${youtubeConfig.key}`;
    let tempMusicList = [];
    // Youtube Playlist API call
    await axios
        .get(URL)
        .then(async res => {
            // Go through the list convert video IDs to youtube links
            await Promise.all(
                res.data.items.map(async video => {
                    const music = {};
                    const videoTitle = video.snippet.title;
                    const videoId = video.snippet.resourceId.videoId;
                    const videoUrl =
                        'https://www.youtube.com/watch?v=' + videoId;
                    // Add all the urls in the playlist to the list.
                    music.url = videoUrl;
                    music.title = videoTitle;
                    tempMusicList.push(music);
                })
            ).then(async () => {
                if (noMusic) {
                    await getStream(tempMusicList[0].url).then(stream => {
                        tempMusicList[0].stream = stream;
                    });
                }
            });
        })
        .catch(err => {
            console.log(err);
            msg.channel.send('There was a problem loading the list.');
        });
    return tempMusicList;
}

module.exports = {
    requestList,
    requestSingleSearch,
    requestSingleSongByLink,
    getStream,
};
