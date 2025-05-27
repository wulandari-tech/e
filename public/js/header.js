// public/js/header.js
document.addEventListener('DOMContentLoaded', function() {
    // User Dropdown Toggle
    const dropdownToggle = document.querySelector('.dropdown-toggle');
    const dropdownMenu = document.querySelector('.dropdown-menu');

    if (dropdownToggle && dropdownMenu) {
        dropdownToggle.addEventListener('click', function(event) {
            event.stopPropagation(); // Mencegah event click menyebar ke window
            dropdownMenu.classList.toggle('show');
        });

        // Klik di luar dropdown akan menutupnya
        window.addEventListener('click', function(event) {
            if (!dropdownToggle.contains(event.target) && !dropdownMenu.contains(event.target)) {
                if (dropdownMenu.classList.contains('show')) {
                    dropdownMenu.classList.remove('show');
                }
            }
        });
    }

    // Mobile Menu Toggle
    const mobileMenuButton = document.querySelector('.mobile-menu-toggle');
    const mainNavigation = document.querySelector('.main-navigation');

    if (mobileMenuButton && mainNavigation) {
        mobileMenuButton.addEventListener('click', function() {
            mainNavigation.classList.toggle('open');
            const isExpanded = mobileMenuButton.getAttribute('aria-expanded') === 'true' || false;
            mobileMenuButton.setAttribute('aria-expanded', !isExpanded);
            
            // Ganti ikon burger ke close (X) dan sebaliknya
            const icon = mobileMenuButton.querySelector('i');
            if (mainNavigation.classList.contains('open')) {
                icon.classList.remove('fa-bars');
                icon.classList.add('fa-times');
            } else {
                icon.classList.remove('fa-times');
                icon.classList.add('fa-bars');
            }
        });
    }
});