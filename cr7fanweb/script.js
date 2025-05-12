
    function playSound() {
        let sound = document.getElementById("sound");
        sound.currentTime = 0; 
        sound.play().catch(error => console.log("Ошибка воспроизведения:", error));
    }



