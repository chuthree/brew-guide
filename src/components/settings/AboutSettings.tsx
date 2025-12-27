'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Minus } from 'lucide-react';
import { useModalHistory, modalHistory } from '@/lib/hooks/useModalHistory';
import { SettingPage } from './atomic';

const CollapsibleSection: React.FC<{
  title: string;
  children: string;
}> = ({ title, children }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [displayedText, setDisplayedText] = React.useState('');
  const [isAnimating, setIsAnimating] = React.useState(false);
  const textRef = React.useRef<HTMLSpanElement>(null);

  React.useEffect(() => {
    if (isOpen) {
      setIsAnimating(true);
      let i = 0;
      const timer = setInterval(() => {
        if (i < children.length) {
          setDisplayedText(children.slice(0, i + 1));
          i++;
        } else {
          clearInterval(timer);
          setIsAnimating(false);
        }
      }, 30);
      return () => clearInterval(timer);
    }
  }, [isOpen, children]);

  const handleToggle = () => {
    if (isOpen && !isAnimating) {
      // 用原生 Selection API 选中文字
      const selection = window.getSelection();
      const range = document.createRange();
      if (textRef.current && selection) {
        range.selectNodeContents(textRef.current);
        selection.removeAllRanges();
        selection.addRange(range);
      }
      setTimeout(() => {
        window.getSelection()?.removeAllRanges();
        setDisplayedText('');
        setIsOpen(false);
      }, 300);
    } else if (!isOpen) {
      setIsOpen(true);
    }
  };

  return (
    <div>
      <p
        onClick={handleToggle}
        className={`flex cursor-pointer items-center gap-1 select-none ${isAnimating ? 'pointer-events-none' : ''}`}
      >
        {isOpen ? <Minus size={16} /> : <Plus size={16} />}
        {title}
      </p>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{}}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <p className="mt-2 ml-4 whitespace-pre-line">
              <span ref={textRef}>{displayedText}</span>
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

interface AboutSettingsProps {
  onClose: () => void;
}

const AboutSettings: React.FC<AboutSettingsProps> = ({ onClose }) => {
  const [isVisible, setIsVisible] = React.useState(false);
  const [commitCount, setCommitCount] = React.useState<number | null>(null);

  React.useEffect(() => {
    fetch('https://gitee.com/api/v5/repos/chu3/brew-guide/contributors')
      .then(res => (res.ok ? res.json() : Promise.reject()))
      .then((data: { contributions: number }[]) => {
        setCommitCount(data.reduce((sum, c) => sum + c.contributions, 0));
      })
      .catch(() => {
        fetch(
          'https://api.github.com/repos/chuthree/brew-guide/commits?per_page=1',
          { method: 'HEAD' }
        )
          .then(res => {
            const match = res.headers
              .get('link')
              ?.match(/page=(\d+)>; rel="last"/);
            if (match) setCommitCount(parseInt(match[1], 10));
          })
          .catch(() => {});
      });
  }, []);

  const onCloseRef = React.useRef(onClose);
  onCloseRef.current = onClose;

  const handleCloseWithAnimation = React.useCallback(() => {
    setIsVisible(false);
    window.dispatchEvent(new CustomEvent('subSettingsClosing'));
    setTimeout(() => {
      onCloseRef.current();
    }, 350);
  }, []);

  useModalHistory({
    id: 'about-settings',
    isOpen: true,
    onClose: handleCloseWithAnimation,
  });

  const handleClose = () => {
    modalHistory.back();
  };

  React.useEffect(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setIsVisible(true);
      });
    });
  }, []);

  return (
    <SettingPage title="关于" isVisible={isVisible} onClose={handleClose}>
      <div className="px-6 pt-4 pb-6">
        <div className="space-y-4 text-base leading-relaxed font-medium">
          <p>
            Hi，很高兴你能看到这里，这是一个因个人需求而生，在群友支持下持续维护的
            <span className="underline decoration-pink-500 decoration-wavy">
              用爱发电项目
            </span>
            。
          </p>
          {commitCount ? (
            <p>
              通过
              <a
                href="https://github.com/chuthree/brew-guide/commits/main"
                target="_blank"
                rel="noopener noreferrer"
                className="mx-0.5 text-neutral-800 underline dark:text-neutral-200"
              >
                {commitCount}
              </a>
              次代码提交，最终变为了你现在看到的样子。
            </p>
          ) : (
            <p>
              通过
              <span className="mx-0.5 inline-block h-4 w-8 animate-pulse rounded bg-neutral-200 align-middle dark:bg-neutral-700" />
              次代码提交，最终变为了你现在看到的样子。
            </p>
          )}
          <hr className="my-6" />
          <CollapsibleSection title="故事">
            {`🤔 不瞒你说，这个项目最初是我用来记录辛鹿方案的...

            有天，鼓起勇气发到群里，得到了很大的支持，才有了不断迭代的动力。
             
            库存功能是后来才加的，现在也慢慢变的比我预想中的要复杂。
            
            不过这也让我明白，这个应用不必做大，定位就是一个小工具，好用，顺手足够了。
            `}
          </CollapsibleSection>
          <CollapsibleSection title="个人">
            {`一位独立开发者(?)，毕业一年正处于迷茫期，开发这个项目，也成为让在过程中不迷失自己的方式。

            我喜欢简洁，安静，不被打扰的感觉。`}
          </CollapsibleSection>
          {/* <p>
            你好，我是{' '}
            <a
              href="https://chu3.top/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-neutral-800 underline dark:text-neutral-200"
            >
              chu3
            </a>
            ，
          </p> */}

          {/* <p>
            感谢你看到这里，这个工具起初是记方案用的。在一次做着做着发到了博主的群里，没想到群友们开始帮忙提建议、推荐给其他人，这个小工具就这样慢慢长大了。从最开始只是记录冲煮方案，到后来发现大家最常用的反而是咖啡豆库存管理，这些都是在和使用者的交流中一点点完善起来的。
          </p>

          <p>
            说实话，开发过程中也有过好几次怀疑，不知道做这个到底有什么意义。但每次收到反馈，或者看到群里有人在讨论怎么用，又或者因为这个应用认识了新朋友，就会觉得，嗯，这样挺好的。能做出一个真的有人在用的东西，这件事本身就很有意思。
          </p>

          <p>
            这个项目是完全开源的，代码放在{' '}
            <a
              href="https://github.com/chuthree/brew-guide"
              target="_blank"
              rel="noopener noreferrer"
              className="text-neutral-800 underline dark:text-neutral-200"
            >
              GitHub
            </a>{' '}
            和{' '}
            <a
              href="https://gitee.com/chu3/brew-guide"
              target="_blank"
              rel="noopener noreferrer"
              className="text-neutral-800 underline dark:text-neutral-200"
            >
              Gitee
            </a>{' '}
            上。如果你遇到问题或者有什么想法，欢迎提 Issue 或
            PR。如果你也在做一些小而美的东西，或者只是想聊聊天，也都欢迎来找我。
          </p> */}
        </div>
      </div>
    </SettingPage>
  );
};

export default AboutSettings;
