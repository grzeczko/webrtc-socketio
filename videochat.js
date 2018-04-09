/**
 * Created by Greg on 11/29/2016.
 */
$(function(){
    window.VideoChat = function(){};

    var position = 0;
    var currentTitle = document.title;

    var ringer, internal, titleScroll;
    var initialized = false;
    var connectWith = 0;
    var connectWithName = '';
    var connectWithPhoto = '';

    var peer, callTo, name, photo;

    var socket = io.connect('//www.example.com:9001', {secure: true});

    socket.on('connect', function (data) {
        socket.emit('storeId', { customId: vkey });
    });

    socket.on('approveCallPrompt', function(data){
        connectWith = data.myId;
        connectWithName = data.name;
        connectWithPhoto = data.photo;
        if (!initialized) init(step1_peer);
        else step1_peer();
    });

    socket.on('busy', function(data){
        stopRing();

        $('.text').hide();
        $('div#busy').show();
    });

    socket.on('declineCall', function(){
        stopRing();

        declineCall();
    });

    socket.on('endCall', function(){
        stopRing();

        $('.text').hide();
        $('div#end').show();

        if (window.existingCall !== undefined) window.existingCall.close();
    });

    /*--------------------------------------------*/

    $.extend(VideoChat, {
        makeCall: function(){
            $('.make-call').unbind('click').click(function() {
                name = $(this).attr("data-username");
                photo = $(this).attr("data-photo");
                callTo = $(this).attr("data-vkey");
                if (!initialized) init(step1_me);
                else step1_me();
            });
        }
    });

    function stopRing() {
        internal.pause();
        internal.currentTime = 0;

        ringer.pause();
        ringer.currentTime = 0;

        window.clearTimeout(titleScroll);
        document.title = currentTitle;
    }

    function init (callback) {
        // initialize audio
        ringer = new Audio('sound/ringer.mp3');
        ringer.loop = true;
        internal = new Audio('sound/internal_ringing.mp3');
        internal.loop = true;

        initialized = true;
        // Compatibility shim
        navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
        // PeerJS object
        peer = new Peer(vkey, {host: 'www.example.com', port: 9000, path: '/speed'});

        peer.on('open', function(){
            callback();
        });

        // Receiving a call
        peer.on('call', function(call){
            // Answer the call automatically (instead of prompting user) for demo purposes
            call.answer(window.localStream);
            step3(call);
        });
    }

    /*--------------------------------------------*/

    // SETUP MY VIDEO
    function step1_me () {
        // Get audio/video stream
        navigator.getUserMedia({audio: true, video: true}, function(stream){
            $("#video-call-container").html('<video id="my-video" muted="true" autoplay></video><video id="their-video" autoplay></video>');

            internal.play();
            showOverlay(false);
            $('#calling').show();
            // Set your video displays
            $('#my-video').prop('src', URL.createObjectURL(stream));

            window.localStream = stream;

            var who = '<img src="' + photo + '" /> ' + name;
            $('.their-id').html(who);

            var myName = $('#me-id').attr('data-username');
            var myPhoto = $('#me-id').attr('data-photo');
            socket.emit('initCall', {callTo: callTo, myId: vkey, name: myName, photo: myPhoto});
        }, function(){
            if ($('body').hasClass('pl')) {
                alert('Nie wykryte mikrofon lub kamera.');
            }
            else {
                alert('No webcam and/or microphone detected.');
            }
        });
    }

    function step1_peer () {
        ringer.play();
        scrolltitle();
        showOverlay(true);
    }

    function step1_peer_callback () {
        $('#end-call').show();
        // Get audio/video stream
        navigator.getUserMedia({audio: true, video: true}, function(stream){
            $("#video-call-container").html('<video id="my-video" muted="true" autoplay></video><video id="their-video" autoplay></video>');
            // Set your video displays
            $('#my-video').prop('src', URL.createObjectURL(stream));

            window.localStream = stream;

            if (connectWith !== 0) {
                var call = peer.call(connectWith, stream);
                step3(call);
            }
        }, function(){
            if (connectWith !== 0) {
                socket.emit('declineCall', {declineTo: connectWith, myId: vkey});
            }

            if ($('body').hasClass('pl')) {
                alert('Nie wykryte mikrofon lub kamera.');
            }
            else {
                alert('No webcam and/or microphone detected.');
            }
        });
    }

    // SHOW THEIR VIDEO
    function step3 (call) {
        stopRing();

        // Hang up on an existing call if present
        if (window.existingCall) {
            window.existingCall.close();
        }

        // Wait for stream on the call, then set peer video display
        call.on('stream', function(stream){
            $('.text').hide();
            $('div#step3').show();
            $('#their-video').prop('src', URL.createObjectURL(stream));
        });

        // UI stuff
        window.existingCall = call;
        //call.on('close', step2);
    }

    function showOverlay (prompt) {
        $('.text').hide();

        if (prompt === true) {
            $('div#prompt').show();

            var who = '<img src="' + connectWithPhoto + '" /> ' + connectWithName;
            $('span#connectWith, .their-id').html(who);

            $('button#accept').click(function(e) {
                stopRing();

                e.preventDefault();
                $('div#prompt').hide();

                step1_peer_callback();
            });

            $('button#decline').click(function(e) {
                stopRing();

                e.preventDefault();

                endCall();
                socket.emit('declineCall', {declineTo: connectWith, myId: vkey});
            });
        }

        $('#overlay').fadeTo('slow', 0.75, function() {
            $('#overlay-video-call').css('visibility','visible');
            $('#overlay-video-call').css('width','75%');
            $('#overlay-video-call').css('height','75%');
            $('#overlay-video-call').show();
        });

        $('.end-call').click(function() {
            endCall();
        });

        $('.end-call-busy').click(function() {
            endCallBusy();
        });
    }

    function endCall() {
        stopRing();

        $('#overlay').fadeTo(0, 0, function() {
            $("#video-call-container").html('');
            $('#overlay-video-call').css('visibility','hidden');
            $('#overlay-video-call, #overlay').hide();
        });

        if (window.existingCall !== undefined) window.existingCall.close();

        socket.emit('endCall', {endTo: callTo, myId: vkey});

        return false;
    }

    function endCallBusy() {
        stopRing();

        $('#overlay').fadeTo(0, 0, function() {
            $("#video-call-container").html('');
            $('#overlay-video-call').css('visibility','hidden');
            $('#overlay-video-call, #overlay').hide();
        });

        if (window.existingCall !== undefined) window.existingCall.close();

        return false;
    }

    function declineCall() {
        $('.text').hide();

        $('div#decline').show();
    }

    function scrolltitle() {
        document.title = msg.substring(position, msg.length) + msg.substring(0, position);
        position++;
        if (position > msg.length) position = 0;
        titleScroll = window.setTimeout(scrolltitle,170);
    }
});
