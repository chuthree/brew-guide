'use client';

import {
  useCallback,
  useEffect,
  useState,
  type MouseEvent,
  type PointerEvent,
} from 'react';
import { useReducedMotion } from 'framer-motion';
import Image from 'next/image';
import { X } from 'lucide-react';
import { useSettingsStore } from '@/lib/stores/settingsStore';
import ActionDrawer from '@/components/common/ui/ActionDrawer';
import styles from './SupportDrawer.module.css';

export const supportShownKey = 'supportDrawerAutoShown';

export function hasViewedSupportCode() {
  try {
    return localStorage.getItem(supportShownKey) === 'code-viewed';
  } catch {
    return false;
  }
}

function markSupportCodeViewed() {
  try {
    localStorage.setItem(supportShownKey, 'code-viewed');
  } catch {
    // 本地存储不可用时仍可正常查看赞赏码。
  }
}

const supportLines = ['如果觉得这个小工具好用，', '可以支持作者一下嘛～'];
const thanksText = '超级无敌感谢你的支持！';
const coffeeWish = '你真的是很好很好的人！祝你天天喝到好喝的咖啡～';
const characterInterval = 55;

const illustrations = [
  { file: 'watercolor-heart.webp', name: '水彩爱心' },
  { file: 'starlight-heart.webp', name: '藏着 Brew Guide 标记的星芒爱心' },
  { file: 'chrome-heart.webp', name: '液态铬心' },
  { file: 'pixel-letter.webp', name: '来自 brewguide 的像素情书' },
  { file: 'mist-heart.webp', name: '雾蓝爱心' },
];

function SupportContent({ onClose }: { onClose: () => void }) {
  const username = useSettingsStore(state => state.settings.username?.trim());
  const thanksMessage = username ? `${username}，${thanksText}` : thanksText;
  const firstMessage = Array.from(thanksMessage);
  const secondMessage = Array.from(coffeeWish);
  const firstLength = firstMessage.length;
  const totalLength = firstLength + secondMessage.length;
  const [step, setStep] = useState<'intro' | 'code' | 'thanks'>('intro');
  const [typedCount, setTypedCount] = useState(1);
  const reduceMotion = useReducedMotion();
  const count = reduceMotion ? totalLength + 1 : typedCount;
  const canReply = count > totalLength;
  useEffect(() => {
    if (step !== 'thanks' || canReply) return;
    const betweenMessages = count === firstLength || count === totalLength;
    const timer = window.setTimeout(
      () => setTypedCount(count + 1),
      betweenMessages ? 320 : characterInterval
    );
    return () => window.clearTimeout(timer);
  }, [step, count, firstLength, totalLength, canReply]);
  const [index, setIndex] = useState(() =>
    Math.floor(Math.random() * illustrations.length)
  );
  const illustration = illustrations[index];
  const advance = useCallback(() => {
    setStep(current => (current === 'intro' ? 'code' : 'thanks'));
  }, []);
  const nextIllustration = useCallback(() => {
    setIndex(current => (current + 1) % illustrations.length);
  }, []);
  const handleIllustrationPress = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      if (event.isPrimary && event.button === 0) nextIllustration();
    },
    [nextIllustration]
  );
  const handleIllustrationClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      if (event.detail === 0) nextIllustration();
    },
    [nextIllustration]
  );
  useEffect(() => {
    if (step !== 'intro' || reduceMotion) return;
    const timer = window.setTimeout(nextIllustration, 6000);
    return () => window.clearTimeout(timer);
  }, [step, reduceMotion, index, nextIllustration]);

  return (
    <>
      <button
        type="button"
        aria-label="关闭"
        onClick={onClose}
        className="absolute top-2 right-2 z-10 grid size-11 place-items-center rounded-full text-neutral-600 dark:text-neutral-300"
      >
        <X size={20} aria-hidden="true" />
      </button>
      <div className="relative">
        <ActionDrawer.Switcher activeKey={step}>
          <div
            className={`grid place-items-center pb-6 ${step === 'thanks' ? '' : 'pt-8'}`}
          >
            {step === 'code' ? (
              <Image
                src="/images/content/appreciation-code.jpg"
                alt="微信赞赏码"
                onLoad={markSupportCodeViewed}
                width={200}
                height={200}
                className="h-auto w-44 rounded-xl"
              />
            ) : step === 'thanks' ? (
              <Image
                src="/images/content/support/author-avatar.webp"
                alt="开发者 chu3 的头像"
                width={80}
                height={80}
                className="size-20 rounded-full"
              />
            ) : (
              <button
                type="button"
                onPointerDown={handleIllustrationPress}
                onClick={handleIllustrationClick}
                aria-label={`当前插画：${illustration.name}，点击切换下一张`}
                className="grid size-32 cursor-pointer place-items-center rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-rose-500"
              >
                <span className={styles.artwork}>
                  {illustrations.map((item, i) => (
                    <Image
                      key={item.file}
                      src={`/images/content/support/${item.file}`}
                      alt=""
                      draggable={false}
                      loading="eager"
                      width={120}
                      height={120}
                      data-active={i === index}
                      className={styles.illustration}
                    />
                  ))}
                </span>
              </button>
            )}
          </div>
          {step === 'thanks' ? (
            <div
              aria-live="polite"
              className="flex flex-col items-start gap-2 text-left text-xl leading-7 font-medium text-neutral-900 dark:text-neutral-100"
            >
              {[firstMessage, secondMessage].map((characters, row) => {
                const visible = row === 0 ? count : count - firstLength;
                if (visible <= 0) return null;
                return (
                  <p key={row} className={styles.message}>
                    <span className="sr-only">{characters.join('')}</span>
                    <span aria-hidden="true">
                      {characters.slice(0, visible).map((character, index) => (
                        <span key={index} className={styles.revealedCharacter}>
                          {character}
                        </span>
                      ))}
                    </span>
                  </p>
                );
              })}
              {canReply && (
                <button
                  type="button"
                  onClick={onClose}
                  className={`${styles.message} ${styles.reply} mt-4 cursor-pointer self-end text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600`}
                >
                  好！
                  <span className="sr-only">关闭抽屉</span>
                </button>
              )}
            </div>
          ) : (
            <p className="mb-8 text-center text-xl leading-7 font-medium text-neutral-900 dark:text-neutral-100">
              {step === 'code' ? (
                '微信扫码，可以请我喝杯咖啡 ww'
              ) : (
                <>
                  <span className="sr-only">{supportLines.join('')}</span>
                  <span aria-hidden="true">
                    {supportLines.map((line, row) => (
                      <span key={line} className="block">
                        {Array.from(line, (character, column) => (
                          <span
                            key={column}
                            className={styles.character}
                            style={{
                              animationDelay: `${350 + row * 110 + column * 50}ms`,
                            }}
                          >
                            {character}
                          </span>
                        ))}
                      </span>
                    ))}
                  </span>
                </>
              )}
            </p>
          )}
          {step !== 'thanks' && (
            <ActionDrawer.Actions>
              <ActionDrawer.PrimaryButton
                className="rounded-xl!"
                onClick={advance}
              >
                {step === 'intro' ? '支持一下' : '好啦'}
              </ActionDrawer.PrimaryButton>
            </ActionDrawer.Actions>
          )}
        </ActionDrawer.Switcher>
      </div>
    </>
  );
}

export default function SupportDrawer({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  return (
    <ActionDrawer
      title="支持开发者"
      isOpen={isOpen}
      onClose={onClose}
      autoFocus
    >
      <SupportContent onClose={onClose} />
    </ActionDrawer>
  );
}
