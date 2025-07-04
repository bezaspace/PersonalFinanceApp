import React from 'react';
import { ArrowRight, Star, Users, TrendingUp } from 'lucide-react';

const Hero = () => {
  const scrollToContact = () => {
    const element = document.getElementById('contact');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section id="home" className="min-h-screen bg-gradient-to-br from-sky-50 to-yellow-50 pt-20">
      <div className="container mx-auto px-6 py-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="text-center lg:text-left">
            <div className="inline-flex items-center bg-yellow-100 text-yellow-800 px-4 py-2 rounded-full text-sm font-medium mb-6">
              <Star className="h-4 w-4 mr-2" />
              #1 Marketing Agency
            </div>
            
            <h1 className="text-5xl lg:text-6xl font-bold text-gray-800 mb-6 leading-tight">
              Launch Your Brand Into
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-sky-400"> Digital Space</span>
            </h1>
            
            <p className="text-xl text-gray-600 mb-8 leading-relaxed">
              We help ambitious businesses reach new heights with cutting-edge marketing strategies, 
              creative campaigns, and data-driven results that propel your brand beyond the ordinary.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 mb-12">
              <button 
                onClick={scrollToContact}
                className="bg-yellow-400 text-white px-8 py-4 rounded-full font-semibold hover:bg-yellow-500 transform hover:scale-105 transition-all duration-200 flex items-center justify-center group"
              >
                Start Your Journey
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </button>
              <button className="border-2 border-sky-400 text-sky-400 px-8 py-4 rounded-full font-semibold hover:bg-sky-400 hover:text-white transition-all duration-200">
                View Our Work
              </button>
            </div>

            <div className="flex items-center justify-center lg:justify-start space-x-8">
              <div className="text-center">
                <div className="flex items-center text-yellow-500 mb-1">
                  <Users className="h-5 w-5 mr-1" />
                  <span className="font-bold text-2xl text-gray-800">500+</span>
                </div>
                <p className="text-gray-600 text-sm">Happy Clients</p>
              </div>
              <div className="text-center">
                <div className="flex items-center text-sky-500 mb-1">
                  <TrendingUp className="h-5 w-5 mr-1" />
                  <span className="font-bold text-2xl text-gray-800">300%</span>
                </div>
                <p className="text-gray-600 text-sm">Avg Growth</p>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="relative z-10">
              <img 
                src="https://images.pexels.com/photos/3184292/pexels-photo-3184292.jpeg?auto=compress&cs=tinysrgb&w=800" 
                alt="Marketing team collaboration" 
                className="rounded-2xl shadow-2xl w-full"
              />
            </div>
            <div className="absolute top-8 -left-8 w-24 h-24 bg-yellow-400 rounded-full opacity-20 animate-pulse"></div>
            <div className="absolute bottom-8 -right-8 w-32 h-32 bg-sky-400 rounded-full opacity-20 animate-pulse delay-1000"></div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;