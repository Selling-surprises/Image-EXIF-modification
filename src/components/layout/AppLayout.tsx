import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import { Menu, Camera, Info, Home, Github } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet';

export const Layout: React.FC = () => {
  const navItems = [
    { name: '首页', path: '/', icon: <Home className="w-4 h-4 mr-2" /> },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4 md:px-8">
          <div className="flex items-center gap-2">
            <Camera className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold tracking-tight">EXIF 编辑器</span>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center space-x-6 text-sm font-medium">
            {navItems.map((item) => (
              <Link key={item.path} to={item.path} className="transition-colors hover:text-primary flex items-center">
                {item.icon}
                {item.name}
              </Link>
            ))}
            <a href="https://github.com" target="_blank" rel="noreferrer" className="transition-colors hover:text-primary flex items-center">
              <Github className="w-4 h-4 mr-2" />
              Github
            </a>
          </nav>

          {/* Mobile Nav */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <Camera className="h-5 w-5 text-primary" />
                  EXIF 编辑器
                </SheetTitle>
              </SheetHeader>
              <div className="flex flex-col space-y-4 mt-8">
                {navItems.map((item) => (
                  <Link key={item.path} to={item.path} className="flex items-center px-2 py-1 text-lg font-semibold">
                    {item.icon}
                    {item.name}
                  </Link>
                ))}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 md:px-8 py-8">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t py-6 md:py-0">
        <div className="container flex flex-col items-center justify-between gap-4 md:h-24 md:flex-row px-4 md:px-8">
          <p className="text-center text-sm leading-loose text-muted-foreground md:text-left">
            Built by 秒哒 &copy; 2026 图片EXIF信息编辑器
          </p>
        </div>
      </footer>
    </div>
  );
};
