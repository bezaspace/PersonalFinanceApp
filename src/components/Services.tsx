import React from 'react';
import { Megaphone, Target, Palette, BarChart3, Globe, Smartphone } from 'lucide-react';

const Services = () => {
  const services = [
    {
      icon: <Megaphone className="h-8 w-8" />,
      title: "Digital Marketing",
      description: "Comprehensive digital marketing strategies that drive engagement and convert leads into loyal customers.",
      color: "yellow"
    },
    {
      icon: <Target className="h-8 w-8" />,
      title: "Brand Strategy",
      description: "Strategic brand positioning that sets you apart from competitors and resonates with your target audience.",
      color: "sky"
    },
    {
      icon: <Palette className="h-8 w-8" />,
      title: "Creative Design",
      description: "Stunning visual designs that capture attention and communicate your brand's unique story effectively.",
      color: "yellow"
    },
    {
      icon: <BarChart3 className="h-8 w-8" />,
      title: "Analytics & Insights",
      description: "Data-driven insights and performance analytics to optimize your marketing ROI and business growth.",
      color: "sky"
    },
    {
      icon: <Globe className="h-8 w-8" />,
      title: "Web Development",
      description: "Custom websites and web applications that deliver exceptional user experiences and drive conversions.",
      color: "yellow"
    },
    {
      icon: <Smartphone className="h-8 w-8" />,
      title: "Social Media",
      description: "Engaging social media campaigns that build communities and amplify your brand's voice across platforms.",
      color: "sky"
    }
  ];

  return (
    <section id="services" className="py-20 bg-white">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl lg:text-5xl font-bold text-gray-800 mb-6">
            Our <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-sky-400">Services</span>
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            We offer a comprehensive suite of marketing services designed to elevate your brand 
            and drive measurable results in today's competitive digital landscape.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {services.map((service, index) => (
            <div 
              key={index} 
              className="group bg-white p-8 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border border-gray-100"
            >
              <div className={`inline-flex p-4 rounded-full mb-6 ${
                service.color === 'yellow' ? 'bg-yellow-100 text-yellow-500' : 'bg-sky-100 text-sky-500'
              } group-hover:scale-110 transition-transform duration-200`}>
                {service.icon}
              </div>
              <h3 className="text-2xl font-bold text-gray-800 mb-4">{service.title}</h3>
              <p className="text-gray-600 leading-relaxed">{service.description}</p>
              <div className={`w-0 h-1 ${
                service.color === 'yellow' ? 'bg-yellow-400' : 'bg-sky-400'
              } group-hover:w-full transition-all duration-300 mt-6 rounded-full`}></div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Services;