const botConfig = require('./botConfig.json');
const Discord = require('discord.js');
const ytdl = require('ytdl-core');
const {
    requestList,
    requestSingleSearch,
    requestSingleSongByLink,
    getStream,
} = require('./requests');

const bot = new Discord.Client(botConfig);

var musicList = [];
var dispatcher = null;
var noMusic = true;

async function play(connection, stream, msg) {
    if (typeof stream === 'undefined') {
        await getStream(musicList[0].url).then(
            stream => (musicList[0].stream = stream)
        );
    }
    // Set the stream for next song if it exists.
    msg.channel.send(
        '▶ Now Playing: ' +
            musicList[0].title +
            '\n' +
            '```' +
            musicList[0].url +
            '```'
    );
    dispatcher = connection
        .playStream(stream, {
            seek: 0,
            volume: 1,
        })
        .on('end', async () => {
            if (musicList.length > 0) {
                await getStream(musicList[0].url).then(
                    stream => (musicList[0].stream = stream)
                );
                play(connection, musicList[0].stream, msg);
            } else {
                msg.channel.send('Queue clear.');
                if (msg.guild.me.voiceChannel === undefined) {
                    msg.channel.send("I'm not in a voice channel.");
                } else {
                    msg.guild.me.voiceChannel.leave();
                }
                musicList = [];
                noMusic = true;
            }
        });
    musicList.shift();
}

function joinCmd(msg) {
    const voiceChannel = msg.member.voiceChannel;
    if (voiceChannel) {
        voiceChannel.join().then(() => {
            msg.channel.send('Successfully connected.').catch(console.log);
        });
    } else {
        msg.channel.send('User is not in a voice channel.');
    }
}

function leaveCmd() {
    musicList = [];
    musicUrlList = [];
    musicTitleList = [];
    dispatcher.end();
}

async function nextCmd(msg) {
    const voiceChannel = msg.member.voiceChannel;
    if (voiceChannel) {
        dispatcher.end();
    }
}

async function playCmd(msg) {
    const voiceChannel = msg.member.voiceChannel;
    if (voiceChannel) {
        voiceChannel
            .join()
            .then(async connection => {
                msg.react('👌');
                link = msg.content.substr(msg.content.indexOf(' ') + 1);
                // Validate URL
                if (ytdl.validateURL(link)) {
                    // If the Link is a list add the list to the play queue
                    if (link.includes('list')) {
                        requestList(
                            link.split('list=')[1],
                            msg,
                            connection,
                            noMusic
                        ).then(tempMusicList => {
                            musicList = musicList.concat(tempMusicList);
                            videoCount = tempMusicList.length;
                            msg.channel.send(
                                'Added ' +
                                    videoCount.toString() +
                                    ' songs to the queue.'
                            );
                            if (noMusic) {
                                noMusic = false;
                                currentMusic = musicList[0];
                                play(connection, musicList[0].stream, msg);
                            }
                        });
                    }
                    // else play the song
                    else {
                        requestSingleSongByLink(link).then(music => {
                            musicList.push(music);
                            if (noMusic) {
                                noMusic = false;
                                currentMusic = musicList[0];
                                play(connection, musicList[0].stream, msg);
                                msg.channel.send(
                                    'Added ' + link + ' to the queue.'
                                );
                            }
                        });
                    }
                }
                // If the given URL is not valid, search it on youtube and add to queue
                else {
                    // Search for keyword on YT
                    requestSingleSearch(link, msg, connection).then(music => {
                        musicList.push(music);
                        if (noMusic) {
                            noMusic = false;
                            currentMusic = musicList[0];
                            play(connection, musicList[0].stream, msg);
                            msg.channel.send(
                                'Added ' + link + ' to the queue.'
                            );
                        }
                    });
                }
            })
            .catch(error => console.log(error));
    } else {
        msg.react('👊');
    }
}

async function playnextCmd(msg) {
    console.log('next');
    const connection = msg.member.voiceChannel.connection;
    link = msg.content.substr(msg.content.indexOf(' ') + 1);
    if (ytdl.validateURL(link)) {
        if (link.includes('list')) {
            msg.channel.send('Cannot add a list to the front of the queue.');
        } else {
            requestSingleSongByLink(link).then(music => {
                musicList.unshift(music);
                if (noMusic === true) {
                    noMusic = false;
                    currentMusic = musicList[0];
                    play(connection, musicList[0].stream, msg);
                } else {
                    msg.channel.send(
                        'Added ' + musicList[0].url + ' to the queue.'
                    );
                }
            });
        }
    } else {
        requestSingleSearch(link, msg, connection).then(music => {
            musicList.unshift(music);
            if (noMusic === true) {
                noMusic = false;
                currentMusic = musicList[0];
                play(connection, musicList[0].stream, msg);
            } else {
                msg.channel.send(
                    'Added ' + musicList[0].url + ' to the queue.'
                );
            }
        });
    }
}

async function shuffleCmd(msg) {
    if (musicList.length === 1) {
        msg.channel.send('There is no songs in the queue.');
    } else {
        shuffle(musicList);
        msg.channel.send('Shuffled.');
        queueCmd(msg);
    }
}

function shuffle(array) {
    var currentIndex = array.length,
        temporaryValue,
        randomIndex;

    // While there remain elements to shuffle...
    while (0 !== currentIndex) {
        // Pick a remaining element...
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex -= 1;

        // And swap it with the current element.
        temporaryValue = array[currentIndex];
        array[currentIndex] = array[randomIndex];
        array[randomIndex] = temporaryValue;
    }

    return array;
}

async function queueCmd(msg) {
    var musicNames = '🎵 Music List: \n';
    for (var i = 0; i < musicList.length; i++) {
        tempStr = musicNames;
        order = i + 1;
        tempStr += order + '- ' + musicList[i].title + '\n';
        if (tempStr.length > 1000) break;
        else musicNames += order + '- ' + musicList[i].title + '\n';
    }
    queueMessage =
        musicList.length === 1
            ? await msg.channel.send('Queue is empty!')
            : await msg.channel
                  .send(`\`\`\`${musicNames}\`\`\``)
                  .then(message => {
                      // TODO
                      //   message.react('◀');
                      //   message.react('▶');
                  });
}

function pauseCmd() {
    dispatcher.pause();
}

function resumeCmd() {
    dispatcher.resume();
}

async function volumeCmd(msg) {
    volume = msg.content.split(' ')[1];
    try {
        volume = parseFloat(volume);
        volume = volume / 100;
        dispatcher.setVolume(volume);
        msg.channel.send(`:mega: Set the volume to ${volume * 100}.`);
    } catch (error) {
        console.log(error);
        msg.channel.send('Please enter a number between 0-100.');
    }
}

bot.on('ready', function() {
    console.log('Logged in as', bot.user.tag);
});

bot.on('message', msg => {
    if (!msg.guild) return;
    const command = msg.content.split(' ')[0];
    switch (command) {
        case '.join':
            joinCmd(msg);
            break;
        case '.leave':
            leaveCmd(msg);
            break;
        case '.play':
            playCmd(msg);
            break;
        case '.playnext':
            playnextCmd(msg);
            break;
        case '.next':
            nextCmd(msg);
            break;
        case '.queue':
            queueCmd(msg);
            break;
        case '.shuffle':
            shuffleCmd(msg);
            break;
        case '.volume':
            volumeCmd(msg);
            break;
        case '.pause':
            pauseCmd(msg);
            break;
        case '.resume':
            resumeCmd(msg);
            break;
    }
});

bot.login(botConfig.token);
