import React from 'react';
import { Award, Lightbulb, Heart, Zap } from 'lucide-react';

const About = () => {
  const values = [
    {
      icon: <Lightbulb className="h-6 w-6" />,
      title: "Innovation",
      description: "We stay ahead of trends and embrace cutting-edge technologies."
    },
    {
      icon: <Heart className="h-6 w-6" />,
      title: "Passion",
      description: "We're passionate about helping businesses achieve their dreams."
    },
    {
      icon: <Award className="h-6 w-6" />,
      title: "Excellence",
      description: "We deliver exceptional results that exceed expectations."
    },
    {
      icon: <Zap className="h-6 w-6" />,
      title: "Speed",
      description: "We move fast and adapt quickly to market changes."
    }
  ];

  return (
    <section id="about" className="py-20 bg-gradient-to-br from-yellow-50 to-sky-50">
      <div className="container mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="text-4xl lg:text-5xl font-bold text-gray-800 mb-6">
              About <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-sky-400">B.E.Z.A Space</span>
            </h2>
            <p className="text-xl text-gray-600 mb-8 leading-relaxed">
              Founded on the belief that every business deserves to reach its full potential, 
              B.E.Z.A Space has been launching brands into digital success for over a decade. 
              We combine creative innovation with strategic thinking to deliver marketing 
              solutions that don't just look good – they work.
            </p>
            <p className="text-lg text-gray-600 mb-8">
              Our team of experienced marketers, designers, and strategists work closely with 
              each client to understand their unique challenges and opportunities, crafting 
              bespoke solutions that drive real business growth.
            </p>
            
            <div className="grid grid-cols-2 gap-6">
              {values.map((value, index) => (
                <div key={index} className="flex items-start space-x-3">
                  <div className="bg-white p-2 rounded-lg shadow-sm">
                    <div className="text-yellow-500">{value.icon}</div>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-800 mb-1">{value.title}</h4>
                    <p className="text-sm text-gray-600">{value.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <img 
              src="https://images.pexels.com/photos/3184465/pexels-photo-3184465.jpeg?auto=compress&cs=tinysrgb&w=800" 
              alt="Creative team at work" 
              className="rounded-2xl shadow-2xl w-full"
            />
            <div className="absolute -bottom-6 -left-6 bg-white p-6 rounded-xl shadow-lg">
              <div className="flex items-center space-x-4">
                <div className="bg-yellow-400 text-white p-3 rounded-full">
                  <Award className="h-6 w-6" />
                </div>
                <div>
                  <div className="font-bold text-2xl text-gray-800">10+</div>
                  <div className="text-gray-600 text-sm">Years Experience</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default About;